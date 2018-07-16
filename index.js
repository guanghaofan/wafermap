export default function (kibana) {

  return new kibana.Plugin({
    name: 'wafermap',
    uiExports: {
      visTypes: ['plugins/wafermap/wafer_map_vis']
    }
  });
}
