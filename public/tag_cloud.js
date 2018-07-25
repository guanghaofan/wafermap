import d3 from 'd3';
import d3TagCloud from 'd3-cloud';
import { seedColors } from 'ui/vis/components/color/seed_colors';
import { EventEmitter } from 'events';

const ORIENTATIONS = {
  'single': () => 0,
  'right angled': (tag) => {
    return hashWithinRange(tag.text, 2) * 90;
  },
  'multiple': (tag) => {
    return ((hashWithinRange(tag.text, 12)) * 15) - 90;//fan out 12 * 15 degrees over top-right and bottom-right quadrant (=-90 deg offset)
  }
};
const D3_SCALING_FUNCTIONS = {
  'linear': () => d3.scale.linear(),
  'log': () => d3.scale.log(),
  'square root': () => d3.scale.sqrt()
};

class TagCloud extends EventEmitter {

  constructor(domNode, marginLeft, marginRight, marginTop, marginBottom, marginNeighbor) {

    super();
    
    //DOM
    this._marginLeft = marginLeft;
    this._marginBottom = marginBottom;
    this._marginTop = marginTop;
    this._marginRight = marginRight;
    this._marginNeighbor = marginNeighbor;
    this._element = domNode;
    this._d3SvgContainer = d3.select(this._element).append('svg');
    this._svgGroup = this._d3SvgContainer.append('g')
        .attr("transform", "translate(" + this._marginLeft + "," + this._marginTop + ")");
    this._size = [1, 1];

    //SETTING (non-configurable)
    this._fontFamily = 'Open Sans, sans-serif';
    this._fontStyle = 'normal';
    this._fontWeight = 'normal';
    this._spiral = 'archimedean';//layout shape
    this._timeInterval = 1000;//time allowed for layout algorithm
    this._padding = 5;

    //OPTIONS
    this._orientation = 'single';
    this._minFontSize = 10;
    this._maxFontSize = 36;
    this._textScale = 'linear';
    this._optionsAsString = null;

    //DATA
    this._words = null;
    this._minZ = 0;
    this._maxZ = 1;
    this._xTitle = null;
    this._yTitle = null;
    this._row = null;
    this._series = false;
    this._showRowY = false;
    this._showColumnX = false;

    //UTIL
    this._setTimeoutId = null;
    this._pendingJob = null;
    this._layoutIsUpdating = null;
    this._allInViewBox = false;
    this._DOMisUpdating = false;
     
    this._x = null;
    this._y = null;
    this._showGrid = false;
  }

  setOptions(options) {

    if (JSON.stringify(options) === this._optionsAsString) {
      return;
    }
    this._optionsAsString = JSON.stringify(options);
    this._orientation = options.orientation;
    this._minFontSize = Math.min(options.minFontSize, options.maxFontSize);
    this._maxFontSize = Math.max(options.minFontSize, options.maxFontSize);
    this._textScale = options.scale;
    this._invalidate(false);
  }
  
  setData(minZ, maxZ, x, y, data, row, series) {
    //this._x = [];
    //this._y = [];
    this._minZ = minZ;
    this._maxZ = maxZ;
    this._x = x;
    this._y = y;
    this._words = data;
    this._row = row;
    this._series =series;
    //this._xTitle = xTitle;
    //this._yTitle = yTitle;
  }
 
  upateSVG() {
    this._invalidate(false);
  }
  clearSVG() {
    this._emptyDOM();
  }

  destroy() {
    clearTimeout(this._setTimeoutId);
    this._element.innerHTML = '';
  }

  getStatus() {
    return this._allInViewBox ? TagCloud.STATUS.COMPLETE : TagCloud.STATUS.INCOMPLETE;
  }

  _updateContainerSize() {
    this._d3SvgContainer.attr('width', this._element.offsetWidth);
    this._d3SvgContainer.attr('height', this._element.offsetHeight);
    this._svgGroup.attr('width', this._element.offsetWidth);
    this._svgGroup.attr('height', this._element.offsetHeight);
  }

  _isJobRunning() {
    return (this._setTimeoutId || this._layoutIsUpdating || this._DOMisUpdating);
  }

  async _processPendingJob() {

    if (!this._pendingJob) {
      return;
    }

    if (this._isJobRunning()) {
      return;
    }


    this._completedJob = null;
    const job = await this._pickPendingJob();
    if (job.words.length) {
      if (job.refreshLayout) {
        await this._updateLayout(job);
      }
      await this._updateDOM(job);
      const cloudBBox = this._svgGroup[0][0].getBBox();
      this._cloudWidth = cloudBBox.width;
      this._cloudHeight = cloudBBox.height;
      this._allInViewBox = cloudBBox.x >= 0 &&
        cloudBBox.y >= 0 &&
        cloudBBox.x + cloudBBox.width <= this._element.offsetWidth &&
        cloudBBox.y + cloudBBox.height <= this._element.offsetHeight;
    } else {
      this._emptyDOM(job);
    }

    if (this._pendingJob) {
      this._processPendingJob();//pick up next job
    } else {
      this._completedJob = job;
      this.emit('renderComplete');
    }

  }

  async _pickPendingJob() {
    return await new Promise((resolve) => {
      this._setTimeoutId = setTimeout(async () => {
        const job = this._pendingJob;
        this._pendingJob = null;
        this._setTimeoutId = null;
        resolve(job);
      }, 0);
    });
  }


  _emptyDOM() {
    this._svgGroup.selectAll('*').remove();
    this._cloudWidth = 0;
    this._cloudHeight = 0;
    this._allInViewBox = true;
    this._DOMisUpdating = false;
  }

  async _updateDOM(job) {

    const canSkipDomUpdate = this._pendingJob || this._setTimeoutId;
    if (canSkipDomUpdate) {
      this._DOMisUpdating = false;
      return;
    }

    this._DOMisUpdating = true;
    
    /**
    const affineTransform = positionWord.bind(null, this._element.offsetWidth / 2, this._element.offsetHeight / 2);
    const svgTextNodes = this._svgGroup.selectAll('text');
    const stage = svgTextNodes.data(job.words, getText);
    **/

    await new Promise((resolve) => {
      const tableCnt = this._words.length;
      let xWidth = 0; // row mode for x coord
      let yHeight = 0; // column mode for y coord
      let cellHeight = 0;
      let cellWidth = 0;
      let chartWidth = 0; // = xWidth - neighbor
      let chartHeight = 0;
      let spaceCellCnt = 0.5;
      
      if (tableCnt === 1) {
        cellHeight = (this._element.offsetHeight - this._marginTop - this._marginBottom) / (this._y.length + spaceCellCnt);
        cellWidth = (this._element.offsetWidth - this._marginLeft - this._marginRight) / ((this._x.length + spaceCellCnt) * tableCnt);
        xWidth = (this._element.offsetWidth - this._marginLeft - this._marginRight) / tableCnt;
        chartWidth = xWidth;
        yHeight = this._element.offsetHeight - this._marginTop - this._marginBottom;
        chartHeight = yHeight;
      }
      else if (this._row) {
        cellHeight = (this._element.offsetHeight - this._marginTop - this._marginBottom) / (this._y.length + spaceCellCnt);
        cellWidth = (this._element.offsetWidth - this._marginLeft - this._marginRight - (tableCnt - 1) * this._marginNeighbor) / ((this._x.length + spaceCellCnt) * tableCnt);
        xWidth = (this._element.offsetWidth - this._marginLeft - this._marginRight - (tableCnt - 1) * this._marginNeighbor) / tableCnt + this._marginNeighbor;
        chartWidth = xWidth - this._marginNeighbor;
        yHeight = this._element.offsetHeight - this._marginTop - this._marginBottom;
        chartHeight = yHeight;
      }
      else {
        cellHeight = (this._element.offsetHeight - this._marginTop - this._marginBottom - (tableCnt - 1) * this._marginNeighbor) /((this._y.length + spaceCellCnt) * tableCnt);
        cellWidth = (this._element.offsetWidth - this._marginLeft - this._marginRight) / (this._x.length + spaceCellCnt);
        yHeight = (this._element.offsetHeight - this._marginTop - this._marginBottom - (tableCnt - 1) * this._marginNeighbor) /tableCnt + this._marginNeighbor;
        chartHeight = yHeight - this._marginNeighbor;
        xWidth = this._element.offsetWidth - this._marginLeft - this._marginRight;
        chartWidth = xWidth;
      }
      
     
       
      this._emptyDOM();
      /**
      var cellHeight = (this._element.offsetHeight - this._marginTop - this._marginBottom) /(this._y.length + 2);
      var cellWidth = (this._element.offsetWidth - this._marginLeft - this._marginRight) / (this._x.length + 2)
      var colorDomain = d3.extent(this._words, function(d){
        return d[2];
      });

   
      var colorScale = d3.scaleLinear()
        .domain(colorDomain)
        .range(["green","blue"]);
   
      function x(d, i) {
        return (i + 1) * cellWidth + this._marginLeft;
      }
   
      function rectx(d, i) {
        return (d.x +1 ) * cellWidth - 0.5*cellWidth + this._marginLeft;
      }
      */

      var colorScale = d3.scale.linear()
        .domain([this._minZ, this._maxZ])
        .range(["#2980B9", "#E67E22", "#27AE60", "#27AE60"]);
 
      let tableNo = 0;
      const isRow = this._row;
      const yBase = this._element.offsetHeight - this._marginBottom - this._marginTop;      
      while (tableNo !== tableCnt) {
     
        if (showGrid) {
          var yLines = this._svgGroup.selectAll("line-" + tableNo)
            .data(this._x)
            .enter()
            .append("line");

          yLines
           .attr("x1", function (d, i) {
                return (isRow || tableCnt === 1 ? tableNo * xWidth + (i + 0.5) * cellWidth + (spaceCellCnt * cellWidth) / 2 : (i + 0.5) * cellWidth + (cellWidth * spaceCellCnt) / 2);
              })
           .attr("y1", function (d, i) {
                return (isRow || tableCnt === 1 ? yBase : ((tableNo === tableCnt - 1) ? yBase :
                  tableNo * yHeight + chartHeight));
             })
           .attr("x2", function (d, i) {
                return (isRow || tableCnt === 1 ? tableNo * xWidth + (i + 0.5) * cellWidth + (spaceCellCnt * cellWidth) / 2 : (i + 0.5) * cellWidth + (cellWidth * spaceCellCnt) / 2);
              })
 
           .attr("y2", function (d, i) {
                return (isRow || tableCnt === 1 ? yBase - chartHeight : ((tableNo === tableCnt - 1) ? yBase - chartHeight :
                  tableNo * yHeight));
             })
           .attr("stroke-width", 1)
           .attr("stroke", "black");
         
          var xLines = this._svgGroup.selectAll("line-" + tableNo)
            .data(this._y)
            .enter()
            .append("line");

          xLines
           .attr("x1", function (d, i) {
                return (isRow || tableCnt === 1 ? xWidth * tableNo : 0);
             })
           .attr("y1", function (d, i) {
                return (isRow || tableCnt === 1 ? (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 : (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 + yHeight * tableNo);
              })

           .attr("x2", function (d, i) {
                return (isRow || tableCnt === 1 ? xWidth * tableNo + xWidth : xWidth);
              })
           .attr("y2", function (d, i) {
                return (isRow || tableCnt === 1 ? (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 : (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 + yHeight * tableNo);
              })

           .attr("stroke-width", 1)
           .attr("stroke", "black");
        } 
  
        // Always show the first y label and last x
        if (tableNo === tableCnt - 1 || this._row || this._showColumnX) {
          var xLabels = this._svgGroup.selectAll("xLabel-" + tableNo)
            .data(this._x)
            .enter().append("text")
              .text(function (d) { return d; })
              .style("text-anchor", "middle")
              .attr("dy", ".5em")
              .attr("x", function (d, i) {
                return (isRow || tableCnt === 1 ? tableNo * xWidth + (i + 0.5) * cellWidth + (spaceCellCnt * cellWidth) / 2 : (i + 0.5) * cellWidth + (cellWidth * spaceCellCnt) / 2); 
              }) 
              .attr("y", function (d, i) {
                return (isRow || tableCnt === 1 ? yBase : ((tableNo === tableCnt - 1) ? yBase :
                  tableNo * yHeight + chartHeight));
             });
        }
        if (tableNo === 0 || (!this._row) || this._showRowY) {
        var yLabels = this._svgGroup.selectAll(".yLabel-" + tableNo)
            .data(this._y)
            .enter().append("text")
              .text(function (d) { return d; })
              .style("text-anchor", "end")
              .attr("dy", ".5em")
              .attr("x",  function (d, i) {
                return (isRow || tableCnt === 1 ? xWidth * tableNo : 0);
              })
              .attr("y", function (d, i) {
                return (isRow || tableCnt === 1 ? (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 : (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 + yHeight * tableNo); 
              });
        }
        var rectangles = this._svgGroup.selectAll("rect-" + tableNo)
          .data(this._series ? this._words[tableNo].tables["0"].rows : this._words[tableNo].rows)
          .enter()
          .append("rect");

        rectangles
          .attr("x", function (d) {
             return (isRow || tableCnt === 1 ? d[0] * cellWidth + (spaceCellCnt * cellWidth) / 2 + tableNo * xWidth : d[0] * cellWidth + (spaceCellCnt * cellWidth / 2)); 
          })
          .attr("y", function(d) {
            return (isRow || tableCnt === 1 ? d[1] * cellHeight + (cellHeight * spaceCellCnt) / 2 : d[1] * cellHeight + (cellHeight * spaceCellCnt) / 2 + tableNo * yHeight);
          })
          .attr("width", cellWidth)
          .attr("height", cellHeight)
          .attr('fill', function(d) {
            return colorScale(d[2]);
          }); 
        tableNo++;
      } 
    });
  }

  _makeTextSizeMapper() {
    const mapSizeToFontSize = D3_SCALING_FUNCTIONS[this._textScale]();
    const range = this._words.length === 1 ? [this._maxFontSize, this._maxFontSize] : [this._minFontSize, this._maxFontSize];
    mapSizeToFontSize.range(range);
    if (this._words) {
      mapSizeToFontSize.domain(d3.extent(this._words, getValue));
    }
    return mapSizeToFontSize;
  }

  _makeNewJob() {
    return {
      refreshLayout: true,
      size: this._size.slice(),
      words: this._words
    };
  }

  _makeJobPreservingLayout() {
    return {
      refreshLayout: false,
      size: this._size.slice(),
      words: this._completedJob.words.map(tag => {
        return {
          x: tag.x,
          y: tag.y,
          rotate: tag.rotate,
          size: tag.size,
          rawText: tag.rawText || tag.text,
          displayText: tag.displayText
        };
      })
    };
  }

  _invalidate(keepLayout) {

    if (!this._words) {
      return;
    }

    this._updateContainerSize();

    const canReuseLayout = false;
    this._pendingJob = (canReuseLayout) ? this._makeJobPreservingLayout() : this._makeNewJob();
    this._processPendingJob();
  }


  async _updateLayout(job) {

    if (job.size[0] <= 0 || job.size[1] <= 0) {
      // If either width or height isn't above 0 we don't relayout anything,
      // since the d3-cloud will be stuck in an infinite loop otherwise.
      return;
    }

    const mapSizeToFontSize = this._makeTextSizeMapper();
    const tagCloudLayoutGenerator = d3TagCloud();
    tagCloudLayoutGenerator.size(job.size);
    tagCloudLayoutGenerator.padding(this._padding);
    tagCloudLayoutGenerator.rotate(ORIENTATIONS[this._orientation]);
    tagCloudLayoutGenerator.font(this._fontFamily);
    tagCloudLayoutGenerator.fontStyle(this._fontStyle);
    tagCloudLayoutGenerator.fontWeight(this._fontWeight);
    tagCloudLayoutGenerator.fontSize(tag => mapSizeToFontSize(tag.value));
    tagCloudLayoutGenerator.random(seed);
    tagCloudLayoutGenerator.spiral(this._spiral);
    tagCloudLayoutGenerator.words(job.words);
    tagCloudLayoutGenerator.text(getDisplayText);
    tagCloudLayoutGenerator.timeInterval(this._timeInterval);

    this._layoutIsUpdating = true;
    await new Promise((resolve) => {
      tagCloudLayoutGenerator.on('end', () => {
        this._layoutIsUpdating = false;
        resolve(true);
      });
      tagCloudLayoutGenerator.start();
    });
  }


  /**
   * Returns debug info. For debugging only.
   * @return {*}
   */
  getDebugInfo() {
    const debug = {};
    debug.positions = this._completedJob ? this._completedJob.words.map(tag => {
      return {
        displayText: tag.displayText,
        rawText: tag.rawText || tag.text,
        x: tag.x,
        y: tag.y,
        rotate: tag.rotate
      };
    }) : [];
    debug.size = {
      width: this._element.offsetWidth,
      height: this._element.offsetHeight
    };
    return debug;
  }

}

TagCloud.STATUS = { COMPLETE: 0, INCOMPLETE: 1 };

function seed() {
  return 0.5;//constant seed (not random) to ensure constant layouts for identical data
}

function getText(word) {
  return word.rawText;
}

function getDisplayText(word) {
  return word.displayText;
}

function positionWord(xTranslate, yTranslate, word) {

  if (isNaN(word.x) || isNaN(word.y) || isNaN(word.rotate)) {
    //move off-screen
    return `translate(${xTranslate * 3}, ${yTranslate * 3})rotate(0)`;
  }

  return `translate(${word.x + xTranslate}, ${word.y + yTranslate})rotate(${word.rotate})`;
}

function getValue(tag) {
  return tag.value;
}

function getSizeInPixels(tag) {
  return `${tag.size}px`;
}

const colorScale = d3.scale.ordinal().range(seedColors);
function getFill(tag) {
  return colorScale(tag.text);
}

function hashWithinRange(str, max) {
  str = JSON.stringify(str);
  let hash = 0;
  for (const ch of str) {
    hash = ((hash * 31) + ch.charCodeAt(0)) % max;
  }
  return Math.abs(hash) % max;
}

export default TagCloud;
