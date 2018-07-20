import React, { Component } from 'react';

export class FeedbackMessage extends Component {

  constructor() {
    super();
    this.state = { shouldShowTruncate: false, shouldShowIncomplete: false, shouldShowInvalidBucketCnt: false};
  }

  render() {
    return (
      <div className="tagcloud-notifications" >
        <div className="tagcloud-truncated-message" style={{ display: this.state.shouldShowTruncate ? 'block' : 'none' }}>
          The number of tags has been truncated to avoid long draw times.
        </div>
        <div className="tagcloud-incomplete-message" style={{ display: this.state.shouldShowIncomplete ? 'block' : 'none' }}>
          The container is too small to display the entire cloud. Tags might be cropped or omitted.
        </div>
        <div className="tagcloud-incomplete-message" style={{ display: this.state.shouldShowInvalidBucketCnt ? 'block' : 'none' }}>
          The wafer map should ONLY have 1 metric enabled to stands for the wafer map color, and 2 terms buckets for x-coord/y-coord.
        </div>
      </div>
    );
  }
}
