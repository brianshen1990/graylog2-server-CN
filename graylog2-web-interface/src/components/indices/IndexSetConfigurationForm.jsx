import React from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { Button, Col, Row } from 'react-bootstrap';

import { Input } from 'components/bootstrap';
import { Spinner } from 'components/common';

import { PluginStore } from 'graylog-web-plugin/plugin';
import IndexMaintenanceStrategiesConfiguration from 'components/indices/IndexMaintenanceStrategiesConfiguration';
import {} from 'components/indices/rotation'; // Load rotation plugin UI plugins from core.
import {} from 'components/indices/retention'; // Load rotation plugin UI plugins from core.

const IndexSetConfigurationForm = React.createClass({
  propTypes: {
    indexSet: React.PropTypes.object.isRequired,
    rotationStrategies: React.PropTypes.array.isRequired,
    retentionStrategies: React.PropTypes.array.isRequired,
    create: React.PropTypes.bool,
    onUpdate: React.PropTypes.func.isRequired,
    cancelLink: React.PropTypes.string.isRequired,
  },

  getInitialState() {
    return {
      indexSet: this.props.indexSet,
      validationErrors: {},
    };
  },

  _updateConfig(fieldName, value) {
    const config = this.state.indexSet;
    config[fieldName] = value;
    this.setState({ indexSet: config });
  },

  _validateIndexPrefix(event) {
    const value = event.target.value;

    if (value.match(/^[a-z0-9][a-z0-9_\-+]*$/)) {
      if (this.state.validationErrors[event.target.name]) {
        const nextValidationErrors = Object.assign({}, this.state.validationErrors);
        delete nextValidationErrors[event.target.name];
        this.setState({ validationErrors: nextValidationErrors });
      }
    } else {
      const nextValidationErrors = Object.assign({}, this.state.validationErrors);
      if (value.length === 0) {
        nextValidationErrors[event.target.name] = 'Invalid index prefix: cannot be empty';
      } else if (value.indexOf('_') === 0 || value.indexOf('-') === 0 || value.indexOf('+') === 0) {
        nextValidationErrors[event.target.name] = 'Invalid index prefix: must start with a letter or number';
      } else if (value.toLowerCase() !== value) {
        nextValidationErrors[event.target.name] = 'Invalid index prefix: must be lower case';
      } else {
        nextValidationErrors[event.target.name] = 'Invalid index prefix: must only contain letters, numbers, \'_\', \'-\' and \'+\'';
      }
      this.setState({ validationErrors: nextValidationErrors });
    }

    this._onInputChange(event);
  },

  _onInputChange(event) {
    this._updateConfig(event.target.name, event.target.value);
  },

  _onDisableOptimizationClick(event) {
    this._updateConfig(event.target.name, event.target.checked);
  },

  _saveConfiguration(event) {
    event.preventDefault();

    const invalidFields = Object.keys(this.state.validationErrors);
    if (invalidFields.length !== 0) {
      document.getElementsByName(invalidFields[0])[0].focus();
      return;
    }

    this.props.onUpdate(this.state.indexSet);
  },

  _updateRotationConfigState(strategy, data) {
    this._updateConfig('rotation_strategy_class', strategy);
    this._updateConfig('rotation_strategy', data);
  },

  _updateRetentionConfigState(strategy, data) {
    this._updateConfig('retention_strategy_class', strategy);
    this._updateConfig('retention_strategy', data);
  },

  render() {
    const indexSet = this.props.indexSet;
    const validationErrors = this.state.validationErrors;

    let rotationConfig;
    if (this.props.rotationStrategies) {
      // The component expects a different structure - legacy
      const activeConfig = {
        config: this.props.indexSet.rotation_strategy,
        strategy: this.props.indexSet.rotation_strategy_class,
      };
      rotationConfig = (<IndexMaintenanceStrategiesConfiguration title="Index Rotation Configuration"
                                                                 description="Graylog uses multiple indices to store documents in. You can configure the strategy it uses to determine when to rotate the currently active write index."
                                                                 selectPlaceholder="Select rotation strategy"
                                                                 pluginExports={PluginStore.exports('indexRotationConfig')}
                                                                 strategies={this.props.rotationStrategies}
                                                                 activeConfig={activeConfig}
                                                                 updateState={this._updateRotationConfigState} />);
    } else {
      rotationConfig = (<Spinner />);
    }

    let retentionConfig;
    if (this.props.retentionStrategies) {
      // The component expects a different structure - legacy
      const activeConfig = {
        config: this.props.indexSet.retention_strategy,
        strategy: this.props.indexSet.retention_strategy_class,
      };
      retentionConfig = (<IndexMaintenanceStrategiesConfiguration title="Index Retention Configuration"
                                                                  description="Graylog uses a retention strategy to clean up old indices."
                                                                  selectPlaceholder="Select retention strategy"
                                                                  pluginExports={PluginStore.exports('indexRetentionConfig')}
                                                                  strategies={this.props.retentionStrategies}
                                                                  activeConfig={activeConfig}
                                                                  updateState={this._updateRetentionConfigState} />);
    } else {
      retentionConfig = (<Spinner />);
    }

    let readOnlyconfig;
    if (this.props.create) {
      const indexPrefixHelp = (
        <span>
          A <strong>unique</strong> prefix used in Elasticsearch indices belonging to this index set.
          The prefix must start with a letter or number, and can only contain letters, numbers, '_', '-' and '+'.
        </span>
      );
      readOnlyconfig = (
        <span>
          <Input type="text"
                 id="index-set-index-prefix"
                 label="索引前缀"
                 name="index_prefix"
                 onChange={this._validateIndexPrefix}
                 value={indexSet.index_prefix}
                 help={validationErrors.index_prefix ? validationErrors.index_prefix : indexPrefixHelp}
                 bsStyle={validationErrors.index_prefix ? 'error' : null}
                 required />
          <Input type="text"
                 id="index-set-index-analyzer"
                 label="分析器"
                 name="index_analyzer"
                 onChange={this._onInputChange}
                 value={indexSet.index_analyzer}
                 help="Elasticsearch 分析器."
                 required />
        </span>
      );
    }

    return (
      <Row>
        <Col md={8}>
          <form className="form" onSubmit={this._saveConfiguration}>
            <Row>
              <Col md={12}>
                <Input type="text"
                       id="index-set-title"
                       label="标题"
                       name="title"
                       onChange={this._onInputChange}
                       value={indexSet.title}
                       help="索引集标题."
                       autoFocus
                       required />
                <Input type="text"
                       id="index-set-description"
                       label="描述"
                       name="description"
                       onChange={this._onInputChange}
                       value={indexSet.description}
                       help="索引集描述."
                       required />
                {readOnlyconfig}
                <Input type="number"
                       id="index-set-shards"
                       label="Index shards"
                       name="shards"
                       onChange={this._onInputChange}
                       value={indexSet.shards}
                       help="Number of Elasticsearch shards used per index in this index set."
                       required />
                <Input type="number"
                       id="index-set-replicas"
                       label="Index replicas"
                       name="replicas"
                       onChange={this._onInputChange}
                       value={indexSet.replicas}
                       help="Number of Elasticsearch replicas used per index in this index set."
                       required />
                <Input type="number"
                       id="index-set-max-num-segments"
                       label="Max. number of segments"
                       name="index_optimization_max_num_segments"
                       min="1"
                       onChange={this._onInputChange}
                       value={indexSet.index_optimization_max_num_segments}
                       help="Maximum number of segments per Elasticsearch index after optimization (force merge)."
                       required />
                <Input type="checkbox"
                       id="index-set-disable-optimization"
                       label="Disable index optimization after rotation"
                       name="index_optimization_disabled"
                       onChange={this._onDisableOptimizationClick}
                       checked={indexSet.index_optimization_disabled}
                       help="Disable Elasticsearch index optimization (force merge) after rotation." />
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                {indexSet.writable && rotationConfig}
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                {indexSet.writable && retentionConfig}
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Button type="submit" bsStyle="primary" style={{ marginRight: 10 }}>保存</Button>
                <LinkContainer to={this.props.cancelLink}>
                  <Button bsStyle="default">取消</Button>
                </LinkContainer>
              </Col>
            </Row>
          </form>
        </Col>
      </Row>
    );
  },
});

export default IndexSetConfigurationForm;
