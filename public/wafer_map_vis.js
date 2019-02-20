import './wafer_map.less';
import './wafer_map_vis_params';
import { VisFactoryProvider } from 'ui/vis/vis_factory';
//import { CATEGORY } from 'ui/vis/vis_category';
import { Schemas } from 'ui/vis/editors/default/schemas';
import { WaferMapVisualization } from './wafer_map_visualization';
import { VisTypesRegistryProvider } from 'ui/registry/vis_types';
import image from './images/icon-wafermap.svg';
import { Status } from 'ui/vis/update_status';
import { legacyTableResponseHandler } from './legacy_response_handler';

VisTypesRegistryProvider.register(function (Private) {

  const VisFactory = Private(VisFactoryProvider);

  return VisFactory.createBaseVisualization({
    name: 'wafermap',
    title: 'wafer map',
    image,
    description: 'Wafer Map to show the wafer testing data',
    //category: CATEGORY.OTHER,
    stage: 'lab',
    visConfig: {
      defaults: {
        colorSchema: 'Green-Red',
        colorScale: 'customzied binning',
        reverseColor: false,
        addTooltip: true,
        showLabel: true,
        defaultAxisOrientation: true
      }
    },
    requiresUpdateStatus: [Status.PARAMS, Status.RESIZE, Status.DATA],
    visualization: WaferMapVisualization,
    responseHandler: legacyTableResponseHandler,
    responseHandlerConfig: {
      asAggConfigResults: true
    },
    editorConfig: {
      collections: {
        colorSchemas: ['Green-Red', 'Green-Blue', 'Green-Yellow' , 'Green-Orange', 'Yellow-Pink', 'LightGreen-SkyBlue', 'DarkGreen-Brown', 'Green-Red-Yellow',
                       'Green-Yellow-Blue', 'Green-Yellow-Red', 'Green-Yellow-Pink', 'Green-Red-Blue', 'Green-Pink-Yellow'],
                       colorScales: ['linear', 'ordinal', 'customzied binning'],

      },
      optionsTemplate: '<wafermap-vis-params></wafermap-vis-params>',
      schemas: new Schemas([
        {
          group: 'metrics',
          name: 'metric',
          title: 'Value',
          min: 1,
          aggFilter: ['!std_dev', '!percentiles', '!percentile_ranks', '!derivative', '!geo_bounds', '!geo_centroid', '!max_bucket', '!avg_bucket', '!min_bucket', '!sum_bucket', '!moving_avg', '!serial_diff', '!cumulative_sum'],
          defaults: [
            { schema: 'metric', type: 'count' }
          ]
        },
        {
          group: 'buckets',
          name: 'x-coord',
          //icon: 'fa fa-cloud',
          title: 'X-Coord',
          min: 1,
          max: 1,
          aggFilter: ['terms']
        },
        {
          group: 'buckets',
          name: 'y-coord',
          //icon: 'fa fa-cloud',
          title: 'Y-Coord',
          min: 1,
          max: 1,
          aggFilter: ['terms']
        },
        {
          group: 'buckets',
          name: 'split',
          title: 'Split Chart',
          min: 0,
          max: 1,
          aggFilter: ['terms']
        }
      ])
    }
  });
});
