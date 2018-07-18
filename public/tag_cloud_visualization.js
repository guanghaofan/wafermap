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

    if (status.params || status.aggs) {
      this._updateParams();
    }

    if (status.data) {
      this._updateData(data);
    }


    if (status.resize) {
      this._resize();
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
    this._feedbackMessage.setState({
      shouldShowTruncate: this._truncated,
      shouldShowIncomplete: this._tagCloud.getStatus() === TagCloud.STATUS.INCOMPLETE
    });
  }


  destroy() {
    this._tagCloud.destroy();
    unmountComponentAtNode(this._feedbackNode);
    unmountComponentAtNode(this._labelNode);

  }

  _updateData(response) {
    if (!response || !response.tables.length) {
      this._tagCloud.setData([]);
      return;
    }
    const mapData = this.generateData(response);
    const data = response.tables[0];
    this._bucketAgg = this._vis.aggs.find(agg => agg.type.name === 'terms');

    const tags = data.rows.map(row => {
      const [tag, count] = row;
      return {
        displayText: this._bucketAgg ? this._bucketAgg.fieldFormatter()(tag) : tag,
        rawText: tag,
        value: count
      };
    });


    if (tags.length > MAX_TAG_COUNT) {
      tags.length = MAX_TAG_COUNT;
      this._truncated = true;
    } else {
      this._truncated = false;
    }
    if(response.tables.length === 1 && response.tables[0].columns.length === 3) {
      this._tagCloud.setData(response.tables[0].rows);
    }
    //this._tagCloud.setWaferMapData(mapData);
  }

  _updateParams() {
    this._tagCloud.setOptions(this._vis.params);
  }

  _resize() {
    this._tagCloud.resize();
  }
  generateData(response) {
    const tableCnt = response.tables.length;
    let rowNo = 0;
    let columnNo =0;
    let maxY = 0;
    let maxX = 0;
    let minZ = 0;
    let maxZ = 0;
    // only one series case
    if (tableCnt == 1) {
      const columnCnt = response.tables[0].columns.length;
      const rowCnt = response.tables[0].rows.length;
      if (columnCnt == 3) {
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
        this._tagCloud.setMinZ(minZ);
        this._tagCloud.setMaxZ(maxZ);
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
        this._tagCloud.setX(x);
        this._tagCloud.setY(y);
      }
      else{

      }
    }
    else if (tableCount > 1) {

    }
  }

}