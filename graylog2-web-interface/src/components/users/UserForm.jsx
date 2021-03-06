import React from 'react';
import Reflux from 'reflux';
import { Button, Row, Col, Alert, Panel } from 'react-bootstrap';
import Routes from 'routing/Routes';

import { Input } from 'components/bootstrap';
import PermissionsMixin from 'util/PermissionsMixin';
import UserNotification from 'util/UserNotification';
import ValidationsUtils from 'util/ValidationsUtils';
import FormsUtils from 'util/FormsUtils';
import ObjectUtils from 'util/ObjectUtils';

import StoreProvider from 'injection/StoreProvider';
const StreamsStore = StoreProvider.getStore('Streams');
const DashboardsStore = StoreProvider.getStore('Dashboards');
const CurrentUserStore = StoreProvider.getStore('CurrentUser');
const UsersStore = StoreProvider.getStore('Users');

import TimeoutInput from 'components/users/TimeoutInput';
import EditRolesForm from 'components/users/EditRolesForm';
import { IfPermitted, MultiSelect, TimezoneSelect, Spinner } from 'components/common';

const UserForm = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
    history: React.PropTypes.object,
  },
  mixins: [PermissionsMixin, Reflux.connect(CurrentUserStore)],
  getInitialState() {
    return {
      streams: undefined,
      dashboards: undefined,
      user: this._getUserStateFromProps(this.props),
    };
  },
  componentDidMount() {
    StreamsStore.listStreams().then((streams) => {
      this.setState({
        streams: streams.sort((s1, s2) => s1.title.localeCompare(s2.title)),
      });
    });
    DashboardsStore.listDashboards().then((dashboards) => {
      this.setState({ dashboards: dashboards.toArray().sort((d1, d2) => d1.title.localeCompare(d2.title)) });
    });
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.user.username !== nextProps.user.username) {
      this.setState({
        user: this._getUserStateFromProps(nextProps),
      });
    }
  },

  _getUserStateFromProps(props) {
    return {
      full_name: props.user.full_name,
      email: props.user.email,
      session_timeout_ms: props.user.session_timeout_ms,
      timezone: props.user.timezone,
      permissions: props.user.permissions,
      read_only: props.user.read_only,
      external: props.user.external,
      roles: props.user.roles,
    };
  },

  formatMultiselectOptions(collection) {
    return collection.map((item) => {
      return { value: item.id, label: item.title };
    });
  },
  formatSelectedOptions(permissions, permission, collection) {
    return collection
      .filter(item => this.isPermitted(permissions, [`${permission}:${item.id}`]))
      .map(item => item.id)
      .join(',');
  },
  _onPasswordChange() {
    const passwordField = this.refs.password.getInputDOMNode();
    const passwordConfirmField = this.refs.password_repeat.getInputDOMNode();

    if (passwordField.value !== '' && passwordConfirmField.value !== '') {
      ValidationsUtils.setFieldValidity(passwordConfirmField, passwordField.value !== passwordConfirmField.value, 'Passwords do not match');
    }
  },

  _changePassword(evt) {
    evt.preventDefault();
    const request = {};

    if (this.refs.old_password) {
      request.old_password = this.refs.old_password.getValue();
    }
    request.password = this.refs.password.getValue();

    UsersStore.changePassword(this.props.user.username, request).then(() => {
      UserNotification.success('密码更新成功.', '成功');
      if (this.isPermitted(this.state.currentUser.permissions, ['users:list'])) {
        this.props.history.replaceState(null, Routes.SYSTEM.AUTHENTICATION.USERS.LIST);
      }
    }, () => {
      UserNotification.error('无法更新密码，请验证密码是否正确.', '更新密码失败');
    });
  },

  _updateUser(evt) {
    evt.preventDefault();

    UsersStore.update(this.props.user.username, this.state.user).then(() => {
      UserNotification.success('用户信息更新成功.', '成功');
      if (this.isPermitted(this.state.currentUser.permissions, ['users:list'])) {
        this.props.history.replaceState(null, Routes.SYSTEM.AUTHENTICATION.USERS.LIST);
      }
      if (this.props.user.username === this.state.currentUser.username) {
        CurrentUserStore.reload();
      }
    }, () => {
      UserNotification.error('无法更新用户信息。请检查服务器日志以获取更多信息.', '更新用户失败');
    });
  },

  _updateField(name, value) {
    const updatedUser = ObjectUtils.clone(this.state.user);
    updatedUser[name] = value;
    this.setState({ user: updatedUser });
  },

  _bindValue(event) {
    this._updateField(event.target.name, FormsUtils.getValueFromInput(event.target));
  },

  _onFieldChange(name) {
    return (value) => {
      this._updateField(name, value);
    };
  },

  _onPermissionsChange(entity, permission) {
    return (entityIds) => {
      const userPermissions = this.state.user.permissions.slice();
      let newUserPermissions = userPermissions.filter(p => p.indexOf(`${entity}:${permission}`) !== 0);

      const updatedPermissions = entityIds === '' ? [] : entityIds.split(',').map(id => `${entity}:${permission}:${id}`);
      const previousPermissions = userPermissions.filter(p => p.indexOf(`${entity}:${permission}`) === 0);

      // Remove edit permissions to entities without read permissions
      if (permission === 'read') {
        previousPermissions.forEach((previousPermission) => {
          // Do nothing if permission is still there
          if (updatedPermissions.some(p => p === previousPermission)) {
            return;
          }

          // Remove edit permission
          const entityId = previousPermission.split(':').pop();
          newUserPermissions = newUserPermissions.filter(p => p !== `${entity}:edit:${entityId}`);
        });
      }

      // Grant read permissions to entities with edit permissions
      if (permission === 'edit') {
        updatedPermissions.forEach((updatePermission) => {
          // Do nothing if permission was there before
          if (previousPermissions.some(p => p === updatePermission)) {
            return;
          }

          // Grant read permission
          const entityId = updatePermission.split(':').pop();
          newUserPermissions.push(`${entity}:read:${entityId}`);
        });
      }

      this._updateField('permissions', newUserPermissions.concat(updatedPermissions));
    };
  },

  _onCancel() {
    this.props.history.goBack();
  },

  render() {
    if (!this.state.streams || !this.state.dashboards) {
      return <Spinner />;
    }

    const user = this.state.user;
    const permissions = this.state.currentUser.permissions;

    let requiresOldPassword = true;
    if (this.isPermitted(permissions, 'users:passwordchange:*')) {
      // Ask for old password if user is editing their own account
      requiresOldPassword = this.props.user.username === this.state.currentUser.username;
    }

    const streamReadOptions = this.formatSelectedOptions(this.state.user.permissions, 'streams:read', this.state.streams);
    const streamEditOptions = this.formatSelectedOptions(this.state.user.permissions, 'streams:edit', this.state.streams);

    const dashboardReadOptions = this.formatSelectedOptions(this.state.user.permissions, 'dashboards:read', this.state.dashboards);
    const dashboardEditOptions = this.formatSelectedOptions(this.state.user.permissions, 'dashboards:edit', this.state.dashboards);

    return (
      <div>
        <Row>
          <Col lg={8}>
            <h2>用户信息</h2>
            <form className="form-horizontal user-form" id="edit-user-form" onSubmit={this._updateUser}>
              {user.read_only &&
                <span>
                  <Col smOffset={3} sm={9}>
                    <Alert bsStyle="warning" role="alert">
                     管理员用户只能在配置文件中修改.
                    </Alert>
                  </Col>
                  <div className="clearfix" />
                  <br />
                </span>
              }
              <fieldset disabled={user.read_only}>
                <Input name="full_name" id="full_name" type="text" maxLength={200} value={user.full_name}
                       onChange={this._bindValue} labelClassName="col-sm-3" wrapperClassName="col-sm-9"
                       label="全名" help="为账户提供描述性的名称."
                       required />

                <Input ref="email" name="email" id="email" type="email" maxLength={254} value={user.email}
                       onChange={this._bindValue} labelClassName="col-sm-3" wrapperClassName="col-sm-9"
                       label="Email" help="联系Email地址." required />

                <IfPermitted permissions="users:edit">
                  <span>
                    <div className="form-group">
                      <Col sm={9} smOffset={3}>
                        <Panel bsStyle="danger" header="设定单个权限不被推荐，请使用角色来替代.">
                          以下权限是一些权限是所有角色综合的权限集，您可在页面底端修改.
                        </Panel>
                      </Col>
                      <label className="col-sm-3 control-label" htmlFor="streampermissions">数据流权限</label>
                      <Col sm={9}>
                        <MultiSelect ref="streamReadOptions" placeholder="选取数据流读权限..."
                                     options={this.formatMultiselectOptions(this.state.streams)}
                                     value={streamReadOptions}
                                     onChange={this._onPermissionsChange('streams', 'read')} />
                        <span className="help-block">选择用户可 <strong>查看</strong>权限
                          . 移除读权限也会将修改权限删除.</span>
                        <MultiSelect ref="streamEditOptions" placeholder="选择数据流修改权限..."
                                     options={this.formatMultiselectOptions(this.state.streams)}
                                     value={streamEditOptions}
                                     onChange={this._onPermissionsChange('streams', 'edit')} />
                        <span className="help-block">选择用户可<strong>修改</strong>数据流
                          . 修改权限会开启读权限.</span>
                      </Col>
                    </div>
                    <div className="form-group">
                      <label className="col-sm-3 control-label" htmlFor="dashboardpermissions">面板权限</label>
                      <Col sm={9}>
                        <MultiSelect ref="dashboardReadOptions" placeholder="选择面板读权限..."
                                     options={this.formatMultiselectOptions(this.state.dashboards)}
                                     value={dashboardReadOptions}
                                     onChange={this._onPermissionsChange('dashboards', 'read')} />
                        <span className="help-block">选择 <strong>读</strong>权限
                          .  移除读权限也会将修改权限删除.</span>
                        <MultiSelect ref="dashboardEditOptions" placeholder="选择面板修改权限..."
                                     options={this.formatMultiselectOptions(this.state.dashboards)}
                                     value={dashboardEditOptions}
                                     onChange={this._onPermissionsChange('dashboards', 'edit')} />
                        <span className="help-block">选择用户可以<strong>编辑</strong>的面板
                          .  改权限会开启读权限.</span>
                      </Col>
                    </div>
                  </span>
                </IfPermitted>
                <IfPermitted permissions="*">
                  <TimeoutInput ref="session_timeout_ms" value={user.session_timeout_ms} labelSize={3} controlSize={9}
                                onChange={this._onFieldChange('session_timeout_ms')} />
                </IfPermitted>

                <Input label="时间区域"
                       help="选择本地时间区域，或者使用系统默认时区."
                       labelClassName="col-sm-3" wrapperClassName="col-sm-9">
                  <TimezoneSelect ref="timezone" className="timezone-select" value={user.timezone}
                                  onChange={this._onFieldChange('timezone')} />
                </Input>

                <div className="form-group">
                  <Col smOffset={3} sm={9}>
                    <Button type="submit" bsStyle="primary" className="create-user save-button-margin">
                      更新用户信息
                    </Button>
                    <Button onClick={this._onCancel}>取消</Button>
                  </Col>
                </div>
              </fieldset>
            </form>
          </Col>
        </Row>
        <Row>
          <Col lg={8}>
            <h2>修改密码</h2>
            {user.read_only ?
              <Col smOffset={3} sm={9}>
                <Alert bsStyle="warning" role="alert">
                管理员密码请在配置文件中修改.
              </Alert>
              </Col>
            :
              user.external ?
                <Col smOffset={3} sm={9}>
                  <Alert bsStyle="warning" role="alert">
                 用户从系统外创建，无法修改密码.
                </Alert>
                </Col>
              :
                <form className="form-horizontal" style={{ marginTop: 10 }} onSubmit={this._changePassword}>
                  {requiresOldPassword &&
                  <Input ref="old_password" name="old_password" id="old_password" type="password" maxLength={100}
                         labelClassName="col-sm-3" wrapperClassName="col-sm-9"
                         label="旧密码" required />
                }
                  <Input ref="password" name="password" id="password" type="password" maxLength={100}
                       labelClassName="col-sm-3" wrapperClassName="col-sm-9"
                       label="新密码" required minLength="6"
                       help="密码必须多于6位，推荐强密码."
                       onChange={this._onPasswordChange} />

                  <Input ref="password_repeat" name="password_repeat" id="password_repeat" type="password" maxLength={100}
                       labelClassName="col-sm-3" wrapperClassName="col-sm-9"
                       label="再次输入密码" required minLength="6" onChange={this._onPasswordChange} />

                  <div className="form-group">
                    <Col smOffset={3} sm={9}>
                      <Button bsStyle="primary" type="submit" className="save-button-margin">
                      修改密码
                    </Button>
                      <Button onClick={this._onCancel}>取消</Button>
                    </Col>
                  </div>
                </form>
            }
          </Col>
        </Row>
        <IfPermitted permissions="users:rolesedit">
          <EditRolesForm user={this.props.user} history={this.props.history} />
        </IfPermitted>
      </div>
    );
  },
});

export default UserForm;
