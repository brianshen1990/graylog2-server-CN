import React from 'react';
import Immutable from 'immutable';
import { Alert } from 'react-bootstrap';

import Dashboard from './Dashboard';
import EditDashboardModalTrigger from './EditDashboardModalTrigger';
import PermissionsMixin from '../../util/PermissionsMixin';

const DashboardList = React.createClass({
  propTypes: {
    dashboards: React.PropTypes.instanceOf(Immutable.List),
    onDashboardAdd: React.PropTypes.func,
    permissions: React.PropTypes.arrayOf(React.PropTypes.string),
  },
  mixins: [PermissionsMixin],
  _formatDashboard(dashboard) {
    return (
      <Dashboard key={`dashboard-${dashboard.id}`} dashboard={dashboard} permissions={this.props.permissions} />
    );
  },
  render() {
    if (this.props.dashboards.isEmpty()) {
      let createDashboardButton;

      if (this.isPermitted(this.props.permissions, ['dashboards:create'])) {
        createDashboardButton = (
          <span>
            <EditDashboardModalTrigger action="create" buttonClass="btn-link btn-text"
                                       onSaved={this.props.onDashboardAdd}>
              创建新的面板
            </EditDashboardModalTrigger>
            .
          </span>
        );
      }
      return (
        <Alert bsStyle="warning">
          <i className="fa fa-info-circle" />&nbsp;
          没有配置好的面板. {createDashboardButton}
        </Alert>
      );
    }

    const dashboardList = this.props.dashboards.sortBy(dashboard => dashboard.title).map(this._formatDashboard);

    return (
      <ul className="streams">
        {dashboardList}
      </ul>
    );
  },
});

export default DashboardList;
