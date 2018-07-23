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
    this._tagCloud = new TagCloud(cloudContainer, this._marginLeft, this._marginRight, this._marginTop, this._marginBottom);
    this._tagCloud.on('select', (event) => {
      if (!this._bucketAgg) {
        return;
      }
      const filter = this._bucketAgg.createFilter(event);
      this._vis.API.queryFilter.addFilters(filter);
    });
    this._renderComplete$ = Observable.fromEvent(this._tagCloud, 'renderComplete');


    this._feedbackNode = document.createElement('div');
    this._containerNode.appendChild(this._feedbackNode);
    this._feedbackMessage = render(<FeedbackMessage />, this._feedbackNode);

    this._labelNode = document.createElement('div');
    this._containerNode.appendChild(this._labelNode);
    this._label = render(<Label />, this._labelNode);
    
    this._series = false;
    this._row = false;
    this._tableCnt = 0;
  }

  async render(data, status) {
    if (this._validateBucket()) {
      if (status.params || status.aggs) {
        this._updateParams();
      }

      if (status.data || status.resize) {
        if (status.data) {
          this._updateData(data);
        }
        this._tagCloud.upateSVG();
      }
    }

    this._feedbackMessage.setState({
      shouldShowInvalidBucketCnt: this._invalidBucketCnt,
      shouldShowIncomplete: this._incomplete
    });

    if (this._invalidBucketCnt || this._incomplete) {
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
  
  _validateBucket() {
    // check the buckets and metrics count
    // TO DO, must be terms-terms or split-terms-terms
    const aggCnt = this._vis.aggs.raw.length;
    let metricCnt = 0;
    let bucketCnt = 0;
    this._series = false;
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
          } 
          break;
      }
    }

    if (bucketCnt < 2 || metricCnt != 1 || (this._series && bucketCnt != 3)) {
      this._invalidBucketCnt = true;
      return false;
    }
    else {
      this._invalidBucketCnt = false;
      if (bucketCnt === 2 && (this._containerNode.clientHeight - this._marginTop - this._marginBottom < 300 || this._containerNode.clientWidth - this._marginLeft - this._marginRight < 300)) {
          this._incomplete = true;
          return false;        
      }
      else if (this._series) {
        if ((this._row
           && ((this._containerNode.clientWidth - this._marginLeft - this._marginRight - (this._tableCnt - 1) * this._marginNeighbor)/this._tableCnt < 300
             || this._containerNode.clientHeight + this._marginTop + this._marginBottom < 300))
           || ((!this._row)
             && ((this._containerNode.clientHeight -  this._marginTop - this._marginBottom - (this._tableCnt - 1) * this._marginNeighbor)/this._tableCnt < 300
              || this._containerNode.clientWidth - this._marginLeft - this._marginRight < 300))) {
          this._incomplete = true;
          return false;
        }
      }
      this._incomplete = false;
      return true;
    }
  }

 
  _updateData(response) {
    // no response
    if (!response || !response.tables.length) {
      return;
    }
    this._generateData(response);
  }

  _updateParams() {
    this._tagCloud.setOptions(this._vis.params);
  }

  _generateData(response) {
    this._tableCnt = response.tables.length;
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
      let chartData = response.tables[tableNo].rows;
      if (this._tableCnt > 1) {
        charData = response.tables[tableNo].tables[0].rows;
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

    /**
    if (tableCnt == 1) {
     
      const rowCnt = response.tables[0].rows.length;
        while (rowNo != rowCnt) {
          maxX = (maxX < response.tables[0].rows[rowNo][0] ? response.tables[0].rows[rowNo][0] : maxX);
          maxY = (maxY < response.tables[0].rows[rowNo][1] ? response.tables[0].rows[rowNo][1] : maxY);
          if(rowNo === 0) {
            minZ = response.tables[0].rows[rowNo][2];
            maxZ = minZ;
          }
	  else {
 	    maxZ = (maxZ < response.tables[0].rows[rowNo][2] ? response.tables[0].rows[rowNo][2] : maxZ);
            minZ = (minZ > response.tables[0].rows[rowNo][2] ? response.tables[0].rows[rowNo][2] : minZ);

          }
          rowNo++;
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
        this._tagCloud.setData(minZ, maxZ, x, y, response.tables[0].rows, response.tables[0].columns[0].title, response.tables[0].columns[1].title);
    }
    else if (this._series) {
      if ((this._row
           && ((this._containerNode.clientWidth - this._marginLeft - this._marginRight - (tableCnt - 1) * this._marginNeighbor)/tableCnt < 300
              || this._containerNode.clientHeight + this._marginTop + this._marginBottom < 300))
        || ((!this._row)
           && ((this._containerNode.clientHeight -  this._marginTop - this._marginBottom - (tableCnt - 1) * this._marginNeighbor)/tableCnt < 300
              || this._containerNode.clientWidth - this._marginLeft - this._marginRight < 300))) {
        this._incomplete = true;
        return;

        // check the maxZ and minZ here
      }
    }
    else {
      console.log("table count >1 but no split settings!");
    }
    */

  }


}
