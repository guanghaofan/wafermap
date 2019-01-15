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

    const cloudContainer = document.createElement('div');
    cloudContainer.classList.add('wafermap-vis');
    this._containerNode.appendChild(cloudContainer);

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
  }

  async render(data, status) {
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
        //if(this._validateCellSize()) {
          this._waferMap.upateSVG();
        //}
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

    if (this._series && response.tables[0].tables["0"].columns.length === 3) {
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
    let minZ = 0;
    let maxZ = 0;
    let tableNo = 0;
    const columnCnt = 3;
    // only one series case

    function formatNum(num) {
      return Math.round(num) === num ? num : num.toFixed(3);
    }
    var category = [];


    while (tableNo !== this._tableCnt) {
      let chartData;
      if (this._tableCnt > 1 || this._series) {
        var temp  = response.tables[tableNo].tables["0"];
        chartData = temp.rows;
        var metricAgg = this._vis.aggs.find(aggConfig=> aggConfig.id === temp.columns[2].aggConfig.id);
        this._fieldFormat = metricAgg.type && metricAgg.type.getFormat(metricAgg);
        if (!this._fieldFormat) {
           this._fieldFormat =  _field_formats.fieldFormats.getDefaultInstance('number');
        }

        //this._fieldFormat = aggMetric.params.field.format;
       // this._fieldFormat = this._vis.aggs[0].params.field.format;
      }
      else {
        chartData = response.tables[tableNo].rows;
        var metricAgg = this._vis.aggs.find(aggConfig=> aggConfig.id === response.tables[tableNo].columns[2].aggConfig.id);
        this._fieldFormat = metricAgg.type && metricAgg.type.getFormat(metricAgg);
        if (!this._fieldFormat) {
          this._fieldFormat =  _field_formats.fieldFormats.getDefaultInstance('number');
        }
      }
      // this is to fix the fake status.data changed once there's split chart bucket
      if (typeof chartData[0][2] === 'string') {
        return;
      }


      let rowNo = 0;
      let columnNo =0;
      const rowCnt = chartData.length;
      while (rowNo != rowCnt) {
        maxX = (maxX < chartData[rowNo][0] ? chartData[rowNo][0] : maxX);
        maxY = (maxY < chartData[rowNo][1] ? chartData[rowNo][1] : maxY);
        if (tableNo ===0 && rowNo === 0) {
          minZ = chartData[rowNo][2];
          maxZ = minZ;
          chartData[rowNo][2] = this._fieldFormat.getConverterFor('text')(chartData[rowNo][2], null, null, null).replace(',', '');
        }
        else {
          maxZ = (maxZ < chartData[rowNo][2] ? chartData[rowNo][2] : maxZ);
          minZ = (minZ > chartData[rowNo][2] ? chartData[rowNo][2] : minZ);
          chartData[rowNo][2] = this._fieldFormat.getConverterFor('text')(chartData[rowNo][2], null, null, null).replace(',', '');
        }
        if (category && category.length < 3) {
          if (!category.includes(chartData[rowNo][2])) {
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
    rowNo = 0;
    let y = new Array(this._maxY);
    let x = new Array(this._maxX);
    while (rowNo != this._maxY) {
      y[rowNo] = rowNo;
      rowNo ++;
    }
    columnNo = 0;
    while (columnNo != this._maxX) {
      x[columnNo] = columnNo;
      columnNo++;
    }
    this._waferMap.setData(minZ, maxZ, x, y, response.tables, this._row, this._series, category.length);
  }
}
