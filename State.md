# DSH Factory Current State

## Release surface

Features 01-12 are implemented through release preparation and deployment observation.

## Implemented

- Change Graph through CI/test Evidence integration.
- Release candidates require a satisfied final Release Gate at the same Graph Revision.
- Content-addressed Release Plan and `release/candidate` Artifact.
- Provider-neutral Deployment Port.
- Immutable deployment receipt Artifact.
- Reality-bound `factory/deployment-observation@1` Evidence.
- Deployment success/failure/cancellation maps to supports/contradicts/inconclusive.
- Successful deployment does not silently close Change.

## Active limitations

- Concrete deployment provider clients are host integrations.
- Production health observation is next.
- No end-user Graph UI.
