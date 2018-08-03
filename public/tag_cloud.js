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

    this._tooltip = d3.select(this._element).append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);




    //SETTING (non-configurable)
    this._fontFamily = 'Open Sans, sans-serif';
    this._fontStyle = 'normal';
    this._fontWeight = 'normal';
    this._spiral = 'archimedean';//layout shape
    this._timeInterval = 1000;//time allowed for layout algorithm
    this._padding = 5;

    //OPTIONS
    this._colorSchema = 'green-red';
    this._showLabel = false;
    this._reverseColor = false;
    this._addTooltip = false;

    //DATA
    this._words = null;
    this._minZ = 0;
    this._maxZ = 1;
    //this._xTitle = null;
    //this._yTitle = null;
    this._row = null;
    this._series = false;
    this._showRowY = false;
    this._showColumnX = false;
    this._colorBucket = 10;
    this._colors = new Array(this._colorBucket);
    this._colorRange = null;
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
    this._showLabel = options.showLabel;
    this._addTooltip = options.addTooltip;
    this._colorSchema = options.colorSchema;
    this._reverseColor = options.reverseColor;
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
      await this._updateDOM(job);
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

      this._colorRange = (this._colorSchema === 'Green-Red' ? ["#008000", "#FF0000"] :
                        this._colorSchema === 'Green-Blue' ? ["#008000", "#0000FF"] :
                        this._colorSchema === 'Green-Yellow' ? ["#008000", "#FFFF00"] :
                        this._colorSchema === 'Green-Orange' ? ["#008000", "#FFA500"] :
                        this._colorSchema === 'Yellow-Pink' ? ["#FFFF00", "#FFC0CB"] :
                        this._colorSchema === 'LightGreen-SkyBlue' ? ["#90EE90", "#87CEEB"] :
                        this._colorSchema === 'DarkGreen-Brown' ? ["#006400", "#A52A2A"] :
                        this._colorSchema === 'Green-Red-Yellow' ? ["#008000", "#FF0000", "#FFFF00"] :
                        this._colorSchema === 'Green-Yellow-Blue' ? ["#008000", "#FFFF00", "#0000FF"] :
                        this._colorSchema === 'Green-Yellow-Red' ? ["#008000", "#FFFF00", "#FF0000"] :
                        this._colorSchema === 'Green-Yellow-Pink' ? ["#008000", "#FFFF00", "#FFC0CB"] :
                        this._colorSchema === 'Green-Red-Blue' ? ["#008000", "#FF0000", "#0000FF"] :
                        this._colorSchema === 'Green-Pink-Yellow' ? ["#008000", "#FFC0CB", "#FFFF00"] :
                        ["#008000", "#FF0000"]
      );

      var colorScale = d3.scale.linear()
        .domain(d3.range(0, 1, 1.0 / (this._colorRange.length)))
        .range(this._colorRange);
      var colorDomain = d3.scale.linear().domain([this._minZ,this._maxZ]).range([0,1]);

      var tooltip = this._tooltip;

      let tableNo = 0;
      let metricTitle = this._series ? this._words[tableNo].tables["0"].columns[2].title : this._words[tableNo].columns[2].title;
      const xTitle = this._series ? this._words[tableNo].tables["0"].columns[0].title : this._words[tableNo].columns[0].title;
      const yTitle = this._series ? this._words[tableNo].tables["0"].columns[1].title : this._words[tableNo].columns[1].title;
      let xTitleLength = xTitle.length;
      let yTitleLength = yTitle.length;
      let metricTitleLength = metricTitle.length;

      const maxX = this._x.length - 1;
      const maxY = this._y.length - 1;
      const reverseColor = this._reverseColor;
      const isRow = this._row;
      const isSeries = this._series;
      const yBase = this._element.offsetHeight - this._marginBottom - this._marginTop;
      while (tableNo !== tableCnt) {
        /**
        var colorDomain = d3.scale.linear().domain(d3.extent(this._series ? this._words[tableNo].tables["0"].rows : this._words[tableNo].rows, function(d){
            return d[2];
          })).range([0,1]);
        **/


        if (this._showGrid) {
          var yLines = this._svgGroup.selectAll("line-" + tableNo)
            .data(this._x)
            .enter()
            .append("line");

          yLines
           .attr('class', 'grid')
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
           .attr('class', 'grid')
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
        /**
        if (this._series) {
            // split series lable
            this._svgGroup.select("series")
              .data (this._words[tableNo].title)
              .enter().append("text")
                .text(this._words[tableNo].title)
                .style("text-anchor", "middle")
                .attr("x",
                  isRow ? xWidth * tableNo + chartWidth / 2 : 0
                )
                .attr("y", isRow ? yHeight : yHeight * tableNo + yHeight / 2);
        }
        **/


        // Always show the first y label and last x
        if (tableNo === tableCnt - 1 || this._row || this._showColumnX) {
          var xLabels = this._svgGroup.selectAll("xLabel-" + tableNo)
            .data(this._x)
            .enter().append("text")
              .text(function (d) { return d; })
              .style("text-anchor", "middle")
              .attr("dy", ".5em")
              .attr("class", "series-title")
              .attr("x", function (d, i) {
                return (isRow || tableCnt === 1 ? tableNo * xWidth + (i + 0.5) * cellWidth + (spaceCellCnt * cellWidth) / 2 : (i + 0.5) * cellWidth + (cellWidth * spaceCellCnt) / 2);
              })
              .attr("y", function (d, i) {
                return (isRow || tableCnt === 1 ? yBase : ((tableNo === tableCnt - 1) ? yBase :
                  tableNo * yHeight + chartHeight));
             });
         // xAxis title
         var xAxisTitle = this._svgGroup.append("text")
             .text(xTitle)
             .attr("x",
               ((!isRow) || tableCnt === 1 ? xWidth / 2 : tableNo * xWidth + chartWidth / 2)
             )
             .attr("y",
               (isRow || tableCnt === 1 ? yBase + (this._series && isRow ? 20 : 30) : ((tableNo === tableCnt - 1) ? yBase + (this._series && isRow ? 20 : 30) :
                 tableNo * yHeight + chartHeight + (this._series && isRow ? 20 : 30)))
             )
             .attr("dy", ".5em")
             .style("text-anchor", "middle");
          // sereis title if necessary
          if (this._series && isRow) {
            var xSeriesTitle = this._svgGroup.append("text")
             .text(this._words[tableNo].title)
             .attr("x",
               ((!isRow) || tableCnt === 1 ? xWidth / 2 : tableNo * xWidth + chartWidth / 2)
             )
             .attr("y",
               (isRow || tableCnt === 1 ? yBase + 35 : ((tableNo === tableCnt - 1) ? yBase + 35 :
                 tableNo * yHeight + chartHeight + 35))
             )
             .attr("dy", ".5em")
             .attr("class", "series-title")
             .style("text-anchor", "middle");
          }

       }

      if (tableNo === 0 || (!this._row) || this._showRowY) {
          var yLabels = this._svgGroup.selectAll(".yLabel-" + tableNo)
            .data(this._y)
            .enter().append("text")
              .text(function (d) { return d; })
              .style("text-anchor", "end")
              .attr("class", "series-title") 
              .attr("dy", ".5em")
              .attr("x",  function (d, i) {
                return (isRow || tableCnt === 1 ? xWidth * tableNo : 0);
              })
              .attr("y", function (d, i) {
                return (isRow || tableCnt === 1 ? (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 : (i + 0.5) * cellHeight + (cellHeight * spaceCellCnt) / 2 + yHeight * tableNo);
              });
          
         // xAxis title
         var yAxisTitle = this._svgGroup.append("text")
             .text(yTitle)
             .attr("transform", "rotate(-90)")
             .attr("x",isRow || tableCnt === 1 ? 0 - chartHeight/2 : 0 - chartHeight/2 - tableNo * yHeight)
             .attr("y", isRow || tableCnt === 1 ? xWidth * tableNo - (this._series && (!isRow)? 25 : 35) : -(this._series && (!isRow)? 25 : 35))
             //.attr("dy", ".5em")
             .style("text-anchor", "middle");

          // sereis title if necessary
          if (this._series && (!isRow)) {
            var ySeriesTitle = this._svgGroup.append("text")
             .text(this._words[tableNo].title)
             .attr("transform", "rotate(-90)")
             .attr("x",isRow || tableCnt === 1 ? 0 - chartHeight/2 : 0 - chartHeight/2 - tableNo * yHeight)
             .attr("y", isRow || tableCnt === 1 ? xWidth * tableNo - 40 : -40)
             .attr("class", "series-title")
             //.attr("dy", ".5em")
             .style("text-anchor", "middle");
          }
          
      }
        var rectangles = this._svgGroup.selectAll("rect-" + tableNo)
          .data(this._series ? this._words[tableNo].tables["0"].rows : this._words[tableNo].rows)
          .enter();

        var map = rectangles.append("rect");

         map.attr("x", function (d) {
             return (isRow || tableCnt === 1 ? d[0] * cellWidth + (spaceCellCnt * cellWidth) / 2 + tableNo * xWidth : d[0] * cellWidth + (spaceCellCnt * cellWidth / 2));
          })
          .attr("y", function(d) {
            return (isRow || tableCnt === 1 ? d[1] * cellHeight + (cellHeight * spaceCellCnt) / 2 : d[1] * cellHeight + (cellHeight * spaceCellCnt) / 2 + tableNo * yHeight);
          })

          .attr("width", cellWidth)
          .attr("height", cellHeight)
          .attr('fill', function(d) {
            return colorScale(reverseColor ? 1 -  colorDomain(d[2]) : colorDomain(d[2]));
          });

          if (this._showLabel) {
            rectangles.append('text')
            .text(function (d) {
              return d[2];
            })
            .style('display', function (d) {
              const textLength = this.getBBox().width;
              const textHeight = this.getBBox().height;
              const textTooLong = textLength > cellWidth;
              const textTooWide = textHeight > cellHeight;
              return textTooLong || textTooWide ? 'none' : 'initial';
            })
            .style('dominant-baseline', 'central')
            .style('text-anchor', 'middle')
            .style('fill', '#000000')
            .attr("x", function (d) {
               return (isRow || tableCnt === 1 ? d[0] * cellWidth + (spaceCellCnt * cellWidth) / 2 + cellWidth / 2 + tableNo * xWidth : d[0] * cellWidth + cellWidth / 2  + (spaceCellCnt * cellWidth / 2));
            })
            .attr("y", function(d) {
              return (isRow || tableCnt === 1 ? d[1] * cellHeight + cellHeight / 2 + (cellHeight * spaceCellCnt) / 2 : d[1] * cellHeight + cellHeight / 2 + (cellHeight * spaceCellCnt) / 2 + tableNo * yHeight);
            });
          }

          map.on("mouseover", function(d) {
             d3.select(this).classed("cell-hover",true);
           })
           .on("mouseout", function(d) {
             d3.select(this).classed("cell-hover",false);
         });


          let seriesTitle = "";
          // add for tooltip
          if (isSeries) {
            seriesTitle = this._words[tableNo].title.split(":")[1]
              + ":"
              + this._words[tableNo].title.split(":")[2];
          }
          let _xTitle = xTitle;
          let _yTitle = yTitle;

          let seriesTitleLength = seriesTitle.length;
          let maxTitleLength = seriesTitleLength > xTitleLength ?
            (seriesTitleLength > yTitleLength ? seriesTitleLength : yTitleLength)
            : (xTitleLength > yTitleLength ? xTitleLength : yTitleLength);
          maxTitleLength = maxTitleLength > metricTitleLength ? maxTitleLength : metricTitleLength;
          while (metricTitleLength ++ < (maxTitleLength)) {
            metricTitle += '&nbsp;';
          }
          while (xTitleLength ++ < maxTitleLength) {
            _xTitle += '&nbsp;';
          }
          while (yTitleLength ++ < maxTitleLength) {
            _yTitle += '&nbsp;';
          }
          while (seriesTitleLength ++ < maxTitleLength) {
            seriesTitle += '&nbsp;';
          }
          seriesTitle = isSeries ? ("<br/>"  + seriesTitle + '&nbsp;' + this._words[tableNo].title.split(":")[0]) : '';

          if (this._addTooltip) {
            map.on("mouseover", function(d) {
              tooltip.html(metricTitle + '&nbsp;' + d[2]
                  + "<br/>"  + _xTitle + '&nbsp;' + d[0]
                  + "<br/>"  + _yTitle + '&nbsp;' + d[1]
                  + seriesTitle
                 )
                 .style("left", (d3.event.offsetX + (d[0] > (maxX - 2) ? (0 -2 * cellWidth)  : d[0] < 2 ? 2 * cellWidth : cellWidth )) + "px")
                 .style("top", (d3.event.offsetY + (d[1] > (maxY - 2) ? (0 - 2 * cellHeight)  : d[1] < 2 ? 2 * cellHeight : cellHeight )) + "px")

                 .style("opacity", 1)
                // .style("background-color", 'black')
                // .style("color",'white')
                ;
            })
            .on("mouseout", function(d) {
              tooltip.style("opacity", 0);
            });
          }


          /**
          .attr('transform', function (d) {
            const horizontalCenter = x(d) + squareWidth / 2;
            const verticalCenter = y(d) + squareHeight / 2;
            return `rotate(${rotate},${horizontalCenter},${verticalCenter})`;
          });
          **/


        tableNo++;
      }

      // add the color legend

      const legendWidth = 20;
      const dis = (this._maxZ - this._minZ) / this._colorBucket;
      let colorNo = 0;
      const legendHeight = chartHeight / (2 * (this._colorBucket + 1));
      while (colorNo != this._colorBucket + 1) {
        this._colors[colorNo] = num2e(dis * colorNo + this._minZ);
        colorNo++;
      }

      var legendLabels = this._svgGroup.selectAll("legendLabel")
          .data(this._colors)
          .enter().append("text")
            .text(function (d) { return d; })
            .attr("x", this._element.offsetWidth - this._marginLeft - legendWidth - 10)
            .attr("y", function (d, i) { return (i + 1.5) * legendHeight; })
            .attr("dy", "0.5em")
            .style("text-anchor", "end");
      var legendTitle = this._svgGroup.append("text")
          .text(this._series ? this._words[0].tables["0"].columns[2].title : this._words[0].columns[2].title)
          .attr("x", this._element.offsetWidth - this._marginLeft - 10)
          .attr("y", legendHeight - 15)
          .style("text-anchor", "end");


      var legendRect = this._svgGroup.selectAll("legendRect")
        .data(this._colors)
        .enter()
        .append("rect");

      legendRect
        .attr("x", this._element.offsetWidth - this._marginLeft - legendWidth - 10)
        .attr("y", function (d, i) { return (i +1) * legendHeight; })
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", function(d){
          return colorScale(reverseColor ? 1- colorDomain(d) : colorDomain(d));
        });


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


function num2e(num){
    if (num ===0) {
      return '0';
    }

    var p = Math.floor(Math.log(Math.abs(num))/Math.LN10);
    var n = num * Math.pow(10, -p);
    return (n.toFixed(3) + 'e' + p);
}

function formatNum(num) {
  return Math.round(num) === num ? num : num.toFixed(1);
}

function getColorValue(reverse) {
  if (!reverse) {
    return
  }
}



export default TagCloud;
