"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.legacyResponseHandlerProvider = void 0;

var _utilities = require("ui/visualize/loader/pipeline_helpers/utilities");

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * The LegacyResponseHandler is not registered as a response handler and can't be used
 * as such anymore. Since the function itself is still used as a utility in the table
 * function and the vislib response handler, we'll keep it for now.
 * As soon as we have a new table implementation (https://github.com/elastic/kibana/issues/16639)
 * we should move this over into or close to the vislib response handler as a pure utility
 * function.
 */
var legacyResponseHandlerProvider = function legacyResponseHandlerProvider() {
  return {
    name: 'legacy',
    handler: function handler(table, dimensions) {
      return new Promise(function (resolve) {
        var converted = {
          tables: []
        };
        var split = dimensions.split_column || dimensions.split_row;

        if (split) {
          converted.direction = dimensions.split_row ? 'row' : 'column';
          var splitColumnIndex = split[0].accessor;
          var splitColumnFormatter = (0, _utilities.getFormat)(split[0].format);
          var splitColumn = table.columns[splitColumnIndex];
          var splitMap = {};
          var splitIndex = 0;
          table.rows.forEach(function (row, rowIndex) {
            var splitValue = row[splitColumn.id];

            if (!splitMap.hasOwnProperty(splitValue)) {
              splitMap[splitValue] = splitIndex++;
              var tableGroup = {
                $parent: converted,
                title: "".concat(splitColumnFormatter.convert(splitValue), ": ").concat(splitColumn.name),
                name: splitColumn.name,
                key: splitValue,
                column: splitColumnIndex,
                row: rowIndex,
                table: table,
                tables: []
              };
              tableGroup.tables.push({
                $parent: tableGroup,
                columns: table.columns,
                rows: []
              });
              converted.tables.push(tableGroup);
            }

            var tableIndex = splitMap[splitValue];
            converted.tables[tableIndex].tables[0].rows.push(row);
          });
        } else {
          converted.tables.push({
            columns: table.columns,
            rows: table.rows
          });
        }

        resolve(converted);
      });
    }
  };
};

exports.legacyResponseHandlerProvider = legacyResponseHandlerProvider;
