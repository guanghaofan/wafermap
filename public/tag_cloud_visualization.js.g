import TagCloud from './tag_cloud';
import { Observable } from 'rxjs';
import { render, unmountComponentAtNode } from 'react-dom';
import React from 'react';


import { Label } from './label';
import { FeedbackMessage } from './feedback_message';

const MAX_TAG_COUNT = 200;

export class TagCloudVisualization {

  constructor(node, vis) {
    this._containerNode = node;

    const cloudContainer = document.createElement('div');
    cloudContainer.classList.add('tagcloud-vis');
    this._containerNode.appendChild(cloudContainer);

    this._vis = vis;
    this._incomplete = false;
    this._invalidBucketCnt = false;
    this._marginTop = 20;
    this._marginBottom = 50;
    this._marginLeft = 50;
    this._marginRight = 50;
    this._marginNeighbor = 50;
    this._tagCloud = new TagCloud(cloudContainer, this._marginLeft, this._marginRight, this._marginTop, this._marginBottom, this._marginNeighbor);
    this._tagCloud.on('select', (event) => {
      if (!this._bucketAgg) {
        return;
      }
      const filter = this._bucketAgg.createFilter(event);
      this._vis.API.queryFilter.addFilters(filter);
    });
    this._renderComplete$ = Observable.fromEvent(this._tagCloud, 'renderComplete');

    this._isSmallSize = false;
    this._isErrorBucket = false;
    this._isEmptyData = false;
    this._feedbackNode = document.createElement('div');
    this._containerNode.appendChild(this._feedbackNode);
    this._feedbackMessage = render(<FeedbackMessage />, this._feedbackNode);

    this._labelNode = document.createElement('div');
    this._containerNode.appendChild(this._labelNode);
    this._label = render(<Label />, this._labelNode);
    
    this._series = false;
    this._row = false;
    this._tableCnt = 0;
    this._mapHeight = 20;
    this._mapWidth = 20;
  }

  async render(data, status) {
    //reset the feedbacks
    this._isErrorBucket = false;
    this._isSmallSize = false;
    this._isEmptyData = false;
  
    if(!(data && data.tables.length)) {
      // no data;
      this._isEmptyData = true;
    } 
    this._tableCnt = data.tables.length;
    if (this._validateBucket() && (!this._isEmptyData)) {
      if (status.params || status.aggs) {
        this._updateParams();
      }

      if (status.data || status.resize) {
        // we must update the data
        if (status.data) {
          this._generateData(data);
        }
        if(this._validateCellSize()) {
          this._tagCloud.upateSVG();
        }
      }
    }

    this._feedbackMessage.setState({
      shouldShowInvalidBucketCnt: this._isErrorBucket,
      shouldShowIncomplete: this._isSmallSize,
      shouldShowEmptyData: this._isEmptyData
    });

    if (this._isEmptyData || this._isErrorBucket || this._isSmallSize) {
     this._tagCloud._emptyDOM();
     return;
    }

    await this._renderComplete$.take(1).toPromise();

    this._label.setState({
      label: `${this._vis.aggs[0].makeLabel()} - ${this._vis.aggs[1].makeLabel()}`,
      shouldShowLabel: this._vis.params.showLabel
    });
  }


  destroy() {
    this._tagCloud.destroy();
    unmountComponentAtNode(this._feedbackNode);
    unmountComponentAtNode(this._labelNode);
  }
  
  _validateCellSize() {
    if (this._series) {
      if ((this._row
         && ((this._containerNode.clientWidth - this._marginLeft - this._marginRight - (this._tableCnt - 1) * this._marginNeighbor) / (this._tableCnt * this._x.length) < this._mapWidth
           || (this._containerNode.clientHeight - this._marginTop - this._marginBottom) / this._y.length < this._mapHeight))
         || ((!this._row)
           && ((this._containerNode.clientHeight -  this._marginTop - this._marginBottom - (this._tableCnt - 1) * this._marginNeighbor) / (this._tableCnt * this._y.length) < this._mapHeight
            || (this._containerNode.clientWidth - this._marginLeft - this._marginRight) / this._x.length < this._mapWidth))) {
        this._isSmallSize = true;
        return false;
      }
    }
    else {
      if ((this._containerNode.clientHeight - this._marginTop - this._marginBottom) / this._y.length < this._mapHeight
         || (this._containerNode.clientWidth - this._marginLeft - this._marginRight) / this._x.length < this._mapWidth) {
        this._isSmallSize = true;
        return false;
      }
    }
    return true;
  }
  
  _validateBucket() {
    // check the buckets and metrics count
    // TO DO, must be terms-terms or split-terms-terms
    const aggCnt = this._vis.aggs.raw.length;
    let metricCnt = 0;
    let bucketCnt = 0;
    this._series = false;
    let seriesBucketNo = 4;
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
            seriesBucketNo = aggNo;
          } 
          break;
      }
    }

    if (bucketCnt < 2 || metricCnt != 1 || (this._series && bucketCnt != 3)
       || (this._series && seriesBucketNo !== 0)) {
      this._isErrorBucket = true;
      return false;
    }
    return true;
  }

  _updateParams() {
    this._tagCloud.setOptions(this._vis.params);
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
 
    while (tableNo !== this._tableCnt) {
      let chartData;
      if (this._tableCnt > 1) {
        var temp  = response.tables[tableNo].tables["0"];
        chartData = temp.rows;
      }
      else {
        chartData = response.tables[tableNo].rows;
      }
      
      let rowNo = 0;
      let columnNo =0;
      const rowCnt = chartData.length;
      while (rowNo != rowCnt) {
        maxX = (maxX < chartData[rowNo][0] ? chartData[rowNo][0] : maxX);
        maxY = (maxY < chartData[rowNo][1] ? chartData[rowNo][1] : maxY);
        if(rowNo === 0) {
          minZ = chartData[rowNo][2];
          maxZ = minZ;
        }
        else {
          maxZ = (maxZ < chartData[rowNo][2] ? chartData[rowNo][2] : maxZ);
          minZ = (minZ > chartData[rowNo][2] ? chartData[rowNo][2] : minZ);
        }
        rowNo++;
      }
      tableNo++;
    }
    
    rowNo = 0;
    let y = new Array(maxY + 1);
    let x = new Array(maxX + 1);
    while (rowNo != maxY + 1) {
      y[rowNo] = rowNo;
      rowNo ++;
    }
    columnNo = 0;
    while (columnNo != maxX + 1) {
      x[columnNo] = columnNo;
      columnNo++;
    }
    this._tagCloud.setData(minZ, maxZ, x, y, response.tables, this._row);
  }
}
