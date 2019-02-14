export default function (kibana) {

  return new kibana.Plugin({
    name: 'wafermap',
    uiExports: {
      visTypes: ['plugins/wafermap/wafer_map_vis'],
      injectDefaultVars(server) {
        const config = server.config();
        return {
          defaultXAxisOrientation: config.get('wafermap.defaultXAxisOrientation'),
          defaultYAxisOrientation: config.get('wafermap.defaultYAxisOrientation'),
          defaultSoftBinName: config.get('wafermap.defaultSoftBinName'),
          defaultHardBinName: config.get('wafermap.defaultHardBinName'),
        };
      },
    },

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        defaultXAxisOrientation: Joi.string().default('asc'),
        defaultYAxisOrientation: Joi.string().default('des'),
        defaultSoftBinName: Joi.string().default('Bin'),
        defaultHardBinName: Joi.string().default('Bin'),
      }).default();
    },

  });
}
