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
    this._bucketAgg = null;
    this._truncated = false;
    this._invalidBucketCnt = false;
    this._tagCloud = new TagCloud(cloudContainer);
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

  }

  async render(data, status) {
    if (this._validateBucket) {
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
      shouldShowTruncate: this._truncated,
      shouldShowIncomplete: this._tagCloud.getStatus() === TagCloud.STATUS.INCOMPLETE
    });

    if (this._invalidBucketCnt) {
     return;
    }

    await this._renderComplete$.take(1).toPromise();

    const hasAggDefined = this._vis.aggs[0] && this._vis.aggs[1];
    if (!hasAggDefined) {
      this._feedbackMessage.setState({
        shouldShowTruncate: false,
        shouldShowIncomplete: false
      });
      return;
    }
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
    const aggCnt = this._vis.aggs.raw.length;
    let metricCnt = 0;
    let bucketCnt = 0;
    let seriesCnt = 0;
    for(let aggNo =0; aggNo != aggCnt; aggNo ++) {
      switch (this._vis.aggs.raw[aggNo].type.type) {
        case "metrics":
          if(this._vis.aggs.raw[aggNo].enabled) {
            metricCnt++;
          }
          break;
        case "buckets":
          if (this._vis.aggs.raw[aggNo].type.name === "terms") {
            bucketCnt++;
          }
          else {
            seriesCnt++;
          }
          break;
      }
    }

    if (bucketCnt !=2 || metricCnt != 1) {
      this._invalidBucketCnt = true;
      return false;
    }
    else {
      this._invalidBucketCnt = false;
      return true;
    }
  }

 
  _updateData(response) {
    // no response
    if (!response || !response.tables.length) {
      return;
    }
    else if (response.tables[0].columns.length != 3) {
      this._validBucketCnt = false;
      return;
    }
    this._generateData(response);
  }

  _updateParams() {
    this._tagCloud.setOptions(this._vis.params);
  }

  _generateData(response) {
    const tableCnt = response.tables.length;
    let rowNo = 0;
    let columnNo =0;
    let maxY = 0;
    let maxX = 0;
    let minZ = 0;
    let maxZ = 0;
    const columnCnt = 3;
    // only one series case
 
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
    else if (tableCount > 1) {

    }
  }

}
