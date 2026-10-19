import { DescribeExecutionCommand, SFNClient } from '@aws-sdk/client-sfn';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getPipelineStatus, setPipelineStatus } from '../repository/publish-repository.js';
import { json } from '../lib/http.js';

const sfn = new SFNClient({});

/**
 * `GET /publish-status` — see `contracts/publish-api.md`.
 *
 * @remarks
 * While a run is in progress, cross-checks the stored status against Step Functions'
 * `DescribeExecution` and self-heals if the execution has actually already finished but the
 * pipeline's own final/Catch task hasn't (yet) updated `PIPELINE#STATUS` — e.g. a Lambda cold
 * start delay (research.md "Trigger and status-polling pattern").
 */
export async function handler(): Promise<APIGatewayProxyStructuredResultV2> {
  let status = await getPipelineStatus();

  if (status.running && status.executionArn) {
    const described = await sfn.send(new DescribeExecutionCommand({ executionArn: status.executionArn }));
    if (described.status && described.status !== 'RUNNING') {
      status = {
        ...status,
        running: false,
        lastResult: described.status === 'SUCCEEDED' ? 'succeeded' : 'failed',
      };
      await setPipelineStatus(status);
    }
  }

  return json(200, {
    running: status.running,
    action: status.action,
    startedAt: status.startedAt,
    lastResult: status.lastResult,
  });
}
