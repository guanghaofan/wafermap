import React, { Component } from 'react';

export class FeedbackMessage extends Component {

  constructor() {
    super();
    this.state = { shouldShowEmptyData: false, shouldShowIncomplete: false, shouldShowInvalidBucketCnt: false};
  }

  render() {
    return (
      <div className="tagcloud-notifications" >
        <div className="tagcloud-truncated-message" style={{ display: this.state.shouldShowTruncate ? 'block' : 'none' }}>
          Empty Data.
        </div>
        <div className="tagcloud-incomplete-message" style={{ display: this.state.shouldShowIncomplete ? 'block' : 'none' }}>
          The container is too small to display the entire wafer map series. Wafer maps might be cropped or omitted if the cell width or height is less than 20.
        </div>
        <div className="tagcloud-incomplete-message" style={{ display: this.state.shouldShowInvalidBucketCnt ? 'block' : 'none' }}>
          The wafer map should ONLY have 1 metric enabled to stands for the wafer map color.
          And the buckets should be [x-coord/y-coord] or [split/x-coord/y-coord].
        </div>
      </div>
    );
  }
}
