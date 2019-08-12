import WaferMap from './wafer_map';
import * as Rx from 'rxjs';
import { take } from 'rxjs/operators';
import { render, unmountComponentAtNode } from 'react-dom';
import React from 'react';

var _field_formats = require('ui/registry/field_formats');

//import { Label } from './label';
import { FeedbackMessage } from './feedback_message';



//const MAX_TAG_COUNT = 200;

export class WaferMapVisualization {

  constructor(node, vis) {
    this._containerNode = node;
    const cloudRelativeContainer = document.createElement('div');
    cloudRelativeContainer.classList.add('wafermap-vis');
    cloudRelativeContainer.setAttribute('style', 'position: relative');

    const cloudContainer = document.createElement('div');
    cloudContainer.classList.add('wafermap-vis');
    this._containerNode.classList.add('visChart--vertical');
    cloudRelativeContainer.appendChild(cloudContainer);
    this._containerNode.appendChild(cloudRelativeContainer);

    // filed format
    this._fieldFormat = null;

    this._vis = vis;
    this._incomplete = false;
    this._invalidBucketCnt = false;
    this._marginTop = 20;
    this._marginBottom = 10;
    this._marginLeft = 40;
    this._marginRight = 110;
    this._marginNeighbor = 30;
    this._waferMap = new WaferMap(cloudContainer, this._marginLeft, this._marginRight, this._marginTop, this._marginBottom, this._marginNeighbor);
    /**
    this._waferMap.on('select', (event) => {
      if (!this._bucketAgg) {
        return;
      }
      const filter = this._bucketAgg.createFilter(event);
      this._vis.API.queryFilter.addFilters(filter);
    });
    **/
    this._renderComplete$ = Rx.fromEvent(this._waferMap, 'renderComplete');

    this._isSmallSize = false;
    this._isErrorBucket = false;
    this._isEmptyData = false;
    this._feedbackNode = document.createElement('div');
    this._containerNode.appendChild(this._feedbackNode);

    this._feedbackMessage = React.createRef();
         render(<FeedbackMessage ref={this._feedbackMessage} />, this._feedbackNode);

    //this._feedbackMessage = render(<FeedbackMessage />, this._feedbackNode);

    /**
    this._labelNode = document.createElement('div');
    this._containerNode.appendChild(this._labelNode);
    this._label = render(<Label />, this._labelNode);
    **/

    /**
    this._tooltip = document.createElement('div');
    this._containerNode.appendChild(this._tooltip);
    **/

    this._series = false;
    this._row = false;
    this._tableCnt = 0;
    this._mapHeight = 5;
    this._mapWidth = 5;
    this._maxX = 1;
    this._maxY = 1;
    this._xId = null;
    this._yId = null;
    this._zId = null;
    this._splitId = null;
  }

  async render(data, visParams, status) {
    //reset the feedbacks
    this._isErrorBucket = false;
    this._isSmallSize = false;
    this._isEmptyData = false;
    const paramsOnly = (!status.data) && (!status.resize) && status.params;
    if(!(data && data.tables.length)) {
      // no data;
      this._isEmptyData = true;
    }
    this._tableCnt = data.tables.length;
    if ((!this._isEmptyData) && this._validateBucket(data)) {
      this._waferMap.setOptions(this._vis.params, paramsOnly);
      if (status.data || status.resize || status.params) {
        // we must update the data
        if (status.data) {
          this._generateData(data);
        }
        if (!this._isEmptyData) {
          this._waferMap.upateSVG();
        }
      }
    }

    this._feedbackMessage.current.setState({
      shouldShowInvalidBucketCnt: this._isErrorBucket,
      shouldShowIncomplete: this._isSmallSize,
      shouldShowEmptyData: this._isEmptyData,
    });



    if (this._isEmptyData || this._isErrorBucket || this._isSmallSize) {
     this._waferMap._emptyDOM();
     return;
    }

    /**
    this._label.setState({
      label: `${this._vis.aggs[0].makeLabel()} - ${this._vis.aggs[1].makeLabel()}`,
      shouldShowLabel: this._vis.params.showLabel
    });
    **/

    await this._renderComplete$.pipe(take(1)).toPromise();

  }


  destroy() {
    this._waferMap.destroy();
    unmountComponentAtNode(this._feedbackNode);
    //unmountComponentAtNode(this._labelNode);
  }

  _validateCellSize() {
    if (this._series) {
      if ((this._row
         && ((this._containerNode.clientWidth - this._marginLeft - this._marginRight - (this._tableCnt - 1) * this._marginNeighbor) / (this._tableCnt * this._maxX) < this._mapWidth
           || (this._containerNode.clientHeight - this._marginTop - this._marginBottom) / this._maxY < this._mapHeight))
         || ((!this._row)
           && ((this._containerNode.clientHeight -  this._marginTop - this._marginBottom - (this._tableCnt - 1) * this._marginNeighbor) / (this._tableCnt * this._maxY) < this._mapHeight
            || (this._containerNode.clientWidth - this._marginLeft - this._marginRight) / this._maxX < this._mapWidth))) {
        this._isSmallSize = true;
        return false;
      }
    }
    else {
      if ((this._containerNode.clientHeight - this._marginTop - this._marginBottom) / this._maxY < this._mapHeight
         || (this._containerNode.clientWidth - this._marginLeft - this._marginRight) / this._maxX < this._mapWidth) {
        this._isSmallSize = true;
        return false;
      }
    }
    return true;
  }

  _validateBucket(response) {
    // check the buckets and metrics count
    // TO DO, must be terms-terms or split-terms-terms
    const aggCnt = this._vis.aggs.raw.length;
    let metricCnt = 0;
    let bucketCnt = 0;
    this._series = false;
    let seriesBucketNo = 0;

    for(let aggNo =0; aggNo != aggCnt; aggNo ++) {
      if (!this._vis.aggs.raw[aggNo].enabled) {
        continue;
      }
      switch (this._vis.aggs.raw[aggNo].type.type) {
        case "metrics":
          metricCnt++;
          break;
        case "buckets":
          if (this._vis.aggs.raw[aggNo].type.name === "terms") {
            bucketCnt++;
          }
          if (this._vis.aggs.raw[aggNo].schema.name === "split") {
            this._series = true;
            this._row = this._vis.aggs.raw[aggNo].params.row;
            seriesBucketNo = bucketCnt;
          }
          break;
      }
    }

    if (bucketCnt < 2 || metricCnt < 1 || (this._series && bucketCnt != 3)
       || (this._series && seriesBucketNo !== 1)) {
      this._isErrorBucket = true;
      return false;
    }

    if (this._series && response.tables[0].tables["0"].columns.length === 4) {
    }
    else if ((!this._series) && response.tables[0].columns.length === 3) {
    }
    else {
      this._isErrorBucket = true;
      return false;
    }

    return true;
  }

  _updateParams(paramsOnly) {
    this._waferMap.setOptions(this._vis.params, paramsOnly);
  }

  _generateData(response) {
    let rowNo = 0;
    let columnNo =0;
    let maxY = 0;
    let maxX = 0;
    let minX = 100;
    let minY = 100;
    let minZ = 0;
    let maxZ = 0;
    let tableNo = 0;
    const columnCnt = 3;
    // only one series case

    function formatNum(num) {
      return Math.round(num) === num ? num : num.toFixed(3);
    }
    var category = [];
    
    var xConfig = this._vis.aggs.find(aggConfig=> aggConfig._opts.schema === 'x-coord');
    var yConfig = this._vis.aggs.find(aggConfig=> aggConfig._opts.schema === 'y-coord');
    var zConfig = this._vis.aggs.find(aggConfig=> aggConfig.type.type === 'metrics');
    
    let zField = zConfig.fieldName()
    
    
    let zName = zConfig.makeLabel();
    let xName = xConfig.params.customLabel ? xConfig.params.customLabel : xConfig.getField().name;
    let yName = yConfig.params.customLabel ? yConfig.params.customLabel : yConfig.getField().name;
    xName = xConfig.makeLabel();
    yName = yConfig.makeLabel();
    
    let colorLabel = this._vis.aggs.find(aggConfig=> aggConfig.type.type === 'metrics').__type.title;
    if(colorLabel != 'Count'){
      colorLabel +=  " " + zField;
    }
    colorLabel = zConfig.makeLabel();
    
    let splitName = '';
    if(this._series){
      splitName = this._vis.aggs.find(aggConfig=> aggConfig._opts.schema === 'split').params.customLabel;
      splitName = this._vis.aggs.find(aggConfig=> aggConfig._opts.schema === 'split').makeLabel();
    }
    
    let xOrder = this._vis.aggs.find(aggConfig=> aggConfig._opts.schema === 'x-coord').params.order.value;
    let yOrder = this._vis.aggs.find(aggConfig=> aggConfig._opts.schema === 'y-coord').params.order.value;

    while (tableNo !== this._tableCnt) {
      let chartData;
      let columns;
      if (this._tableCnt > 1 || this._series) {
        var temp  = response.tables[tableNo].tables["0"];
        chartData = temp.rows;
        columns = temp.columns;
        
        if (chartData.length ===0 || temp.columns.length ===0) {
          this._isEmptyData = true;
          return;
        }
        var metricAgg = this._vis.aggs.find(aggConfig=> aggConfig.type.type === 'metrics');
        this._fieldFormat = metricAgg.type && metricAgg.type.getFormat(metricAgg);
        if (!this._fieldFormat) {
           this._fieldFormat =  _field_formats.fieldFormats.getDefaultInstance('number');
        }

        //this._fieldFormat = aggMetric.params.field.format;
       // this._fieldFormat = this._vis.aggs[0].params.field.format;
      }
      else {
        chartData = response.tables[tableNo].rows;
        columns = response.tables[tableNo].columns;
        if (chartData.length === 0 || response.tables[tableNo].columns.length ===0) {
          // there's no x or no y data
          this._isEmptyData = true;
          return;
        }
        var metricAgg = this._vis.aggs.find(aggConfig=> aggConfig.type.type === 'metrics');
        this._fieldFormat = metricAgg.type && metricAgg.type.getFormat(metricAgg);
        if (!this._fieldFormat) {
          this._fieldFormat =  _field_formats.fieldFormats.getDefaultInstance('number');
        }
      }
      // this is to fix the fake status.data changed once there's split chart bucket
      if (typeof chartData[0][2] === 'string') {
        return;
      }
      
      // map the xId/yId/zId/splitId to the response table columns
      this._xId = columns.find(column=> column.name === xName).id;
      this._yId = columns.find(column=> column.name === yName).id;
      this._zId = columns.find(column=> column.name === zName).id;
      if(this._series){
        this._splitId = columns.find(column=> column.name === splitName).id;
      }
      


      let rowNo = 0;
      let columnNo =0;
      const rowCnt = chartData.length;
      while (rowNo != rowCnt) {
        let x = chartData[rowNo][this._xId];
        let y = chartData[rowNo][this._yId];
        let z = chartData[rowNo][this._zId];
        
        maxX = (maxX < x ? x : maxX);
        maxY = (maxY < y ? y : maxY);
        minX = (minX > x ? x : minX);
        minY = (minY > y ? y : minY);

        if (tableNo ===0 && rowNo === 0) {
          var floatData = 0.0 + z;
          minZ = floatData;
          maxZ = minZ;
          chartData[rowNo][2] = this._fieldFormat.getConverterFor('text')(floatData, null, null, null).replace(',', '');
        }
        else {
          var floatData = 0.0 + z;
          maxZ = (maxZ < floatData ? floatData : maxZ);
          minZ = (minZ > floatData ? floatData : minZ);
          chartData[rowNo][2] = this._fieldFormat.getConverterFor('text')(floatData, null, null, null).replace(',', '');
        }
        if (category && category.length < 3) {
          if (!category.includes(z)) {
            category.push(chartData[rowNo][2]);
          }
        }
        rowNo++;
      }
      tableNo++;
    }
    
    
    
    minZ = parseFloat (this._fieldFormat.getConverterFor('text')(minZ, null, null, null).replace(',', ''));
    maxZ = parseFloat (this._fieldFormat.getConverterFor('text')(maxZ, null, null, null).replace(',', ''));
    this._maxX = maxX + 1;
    this._maxY = maxY + 1;
    minX = minX + 0;
    minY = minY + 0;
    rowNo = 0;
    let y = [];
    let x = [];
    /*
    while (rowNo != this._maxY) {
      y[rowNo] = rowNo;
      rowNo ++;
    }
    columnNo = 0;
    while (columnNo != this._maxX) {
      x[columnNo] = columnNo;
      columnNo++;
    }
    */
      rowNo = minY;
      while (rowNo != this._maxY) {
        y[rowNo - minY] = rowNo;
        rowNo ++;
      }
      columnNo = minX;
      while (columnNo != this._maxX) {
        x[columnNo - minX] = columnNo;
        columnNo++;
      }
    this._waferMap.setData(minZ, maxZ, x, y, response.tables, this._row, this._series, category.length, this._xId, this._yId, this._zId, this._splitId, xName, yName, zName, zField, colorLabel, xOrder, yOrder);
  }
}
