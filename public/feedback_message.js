//import React, { Component } from 'react';
import React, { Component, Fragment } from 'react';
import { FormattedMessage } from '@kbn/i18n/react';
import { EuiIconTip } from '@elastic/eui';

export class FeedbackMessage extends Component {

  constructor() {
    super();
    this.state = { shouldShowEmptyData: false, shouldShowIncomplete: false, shouldShowInvalidBucketCnt: false};
  }

  render() {
    if ((!this.state.shouldShowEmptyData) && (!this.state.shouldShowInvalidBucketCnt)) {
      return '';
    }

    return (
      <EuiIconTip
        type="alert"
        color="warning"
        content={(
          <Fragment>
            {this.state.shouldShowEmptyData &&
              <p>
                <FormattedMessage
                  id="tagCloud.feedbackMessage.truncatedTagsDescription"
                  defaultMessage="Empty data return from database, please check your selected time range."
                />
              </p>
            }
            {this.state.shouldShowIncomplete &&
              <p>
                <FormattedMessage
                  id="tagCloud.feedbackMessage.tooSmallContainerDescription"
                  defaultMessage="The wafer map should ONLY have 1 metric ENABLED and SHOW to stand for the wafer map color,
                    And the buckets should be [x-coord/y-coord] or [split/x-coord/y-coord]."
                />
              </p>
            }
          </Fragment>
        )}
      />
    );
  }
}
