# Experiment Protocol

## 1. Experiment Title

**Pilot Study: Collection of Natural Interaction Data on an Electronic-Products E-commerce Website for Next-Action Prediction**

## 2. Research Objective

The objective of this pilot experiment is to assess the feasibility of collecting reliable, naturalistic interaction data from users while they browse an e-commerce website offering electronic products. The collected interaction sequences will form the basis for later machine-learning research aimed at predicting a user's next observable action within a browsing session.

The pilot will also be used to identify practical issues in the task design, tracking implementation, data completeness, and data-preparation workflow before a larger study is conducted. This stage does not use webcam-based measurement or eye tracking. Eye-tracker data may be incorporated in a later phase of the research under a separately defined protocol.

## 3. Research Questions

1. Can the website record complete and temporally ordered interaction sequences during realistic product-browsing tasks?
2. Which interaction-event patterns, page contexts, and product or category contexts are available as useful features for predicting the next user action?
3. Are the recorded data sufficiently consistent and complete to construct machine-learning-ready session sequences?
4. What usability, technical, or procedural issues should be addressed before a larger-scale experiment?

## 4. Participants

The pilot will involve 5–10 participants. The target population and recruitment method will be determined by the researcher in consultation with the thesis supervisor before recruitment begins.

Participants should be able to use a standard desktop or laptop web browser with a mouse. The final eligibility criteria and consent procedure require supervisor/researcher approval before recruitment. Participation is voluntary, and participants may discontinue the session at any time without providing a reason.

## 5. Experimental Environment

The experiment will be conducted using the project's e-commerce website, which presents electronic products including laptops, graphics processing units (GPUs), monitors, keyboards, and mice. The pilot uses desktop or laptop interaction with a mouse. The detailed device, browser, and study-setting arrangements will be documented for each data-collection session.

Participants will interact with the website using a mouse. No webcam, screen recording, audio recording, biometric sensor, or eye tracker will be used in this pilot experiment.

Before each session, the researcher will verify that the website and event logging are available and that the session can begin without requiring a participant account or personally identifying information.

## 6. Experimental Procedure

1. The participant receives the approved study information and completes the approved consent procedure.
2. The researcher assigns a pseudonymous session identifier and explains the general browsing scenario and tasks. The participant is informed that website interactions, rather than personal identity, are being recorded.
3. The participant is given a short opportunity to become familiar with the website interface, if required.
4. The participant completes the browsing tasks in the order specified in Section 8. They are encouraged to interact naturally and to make choices as they normally would when considering electronic products.
5. The tracking system records interaction events throughout the session.
6. At the end of the tasks, the participant may provide optional feedback regarding unclear tasks, technical problems, or usability issues.
7. The researcher verifies that the session log has been saved and records any observed technical interruption or protocol deviation.

The researcher should avoid directing participants toward particular products or interaction paths beyond the task instructions.

## 7. Duration

Each pilot session is expected to last approximately 10–15 minutes per participant, including briefing, task completion, and optional feedback. The actual duration of each session will be recorded using the event timestamps and, where applicable, the study log.

## 8. Tasks

Tasks are designed to elicit realistic exploration, comparison, and navigation behavior without requiring participants to purchase a product. The exact participant tasks, their wording, and the general participant instructions are defined in [tasks.md](tasks.md). Participants remain free to choose which products to inspect and which navigation paths to follow.

Any revision to the task set after pilot observations will be documented so that data collected under different protocol versions can be distinguished.

## 9. Data Collected

The website records the following event-level fields:

| Field | Description |
| --- | --- |
| `session_id` | Pseudonymous identifier linking events from the same browsing session. |
| `event_type` | Type of recorded interaction, such as mouse movement, hover, click, scroll, or navigation. |
| `timestamp` | Time at which the event was recorded. |
| `x`, `y` | Coordinates associated with the recorded interaction, where applicable. |
| `mouse_x`, `mouse_y` | Mouse-pointer coordinates, where applicable. |
| `product_id` | Identifier of the product associated with the event, where applicable. |
| `category` | Product category associated with the event or page context, where applicable. |
| `scroll_position` | Recorded page scroll position, where applicable. |

The interaction types currently tracked are mouse movements, hover events, clicks, scroll events, and navigation between pages. Fields that are not applicable to a given event may be empty or marked according to the logging schema. No name, email address, account credentials, payment information, webcam image, eye-tracking signal, or other biometric data will be collected for this pilot through the tracking system.

The raw data are stored as SQLite event logs. These raw logs and their existing fields will remain unchanged throughout the pilot and subsequent analysis.

## 10. Privacy and Anonymization

Each participant will be represented in the research dataset by a pseudonymous `session_id`. Direct identifiers will not be included in the interaction-event dataset. Any handling of consent records or recruitment contact details, including whether a linkage procedure is required, will follow the approved consent and data-management procedure.

Data will be reported only in aggregated, anonymized, or otherwise non-identifying form. Free-text feedback, if collected, will be reviewed before use to remove any directly identifying information. The study information and consent materials will clearly describe the recorded interaction data, the purpose of the pilot, data access, retention, and withdrawal procedure.

## 11. Data Storage

The raw SQLite event logs will be stored separately from derived datasets and access will be limited to authorized research personnel. The storage location, responsible party, and access-control arrangements require supervisor/researcher approval before data collection. Storage should use appropriate access controls and, where available, encryption in transit and at rest.

Raw SQLite event logs, cleaned datasets, and derived machine-learning datasets will be versioned or otherwise clearly separated to preserve provenance. The retention period, backup arrangements, and procedure for secure deletion require supervisor/researcher approval before the study begins. Any transfer of data outside the primary storage environment will be documented and restricted to authorized research purposes.

## 12. Data Quality Checks

After each session and before analysis, the following checks will be performed:

1. Confirm that every event has a valid `session_id`, `event_type`, and timestamp.
2. Verify that timestamps within each session can be ordered and identify duplicate, missing, or implausible timestamps.
3. Check that coordinate and scroll-position values are within plausible ranges when present.
4. Check that product identifiers and categories correspond to valid website content when present.
5. Identify incomplete sessions, tracking interruptions, repeated events caused by technical faults, and sessions with no meaningful interaction.
6. Document exclusions, corrections, and protocol deviations without silently overwriting the raw data.

The criteria for excluding a session or event sequence will be finalized after reviewing pilot data and before training predictive models.

## 13. Preparation of Data for Machine Learning

The raw SQLite event logs will be preserved unchanged. A separate, reproducible feature-engineering pipeline will transform copies of the raw records into ordered event sequences grouped by `session_id`. Events will be sorted by timestamp and represented using the available contextual fields, including event type, coordinates where relevant, product identifier, category, and scroll position.

For next-action prediction, each eligible event in a session may serve as an input context and the subsequent event type, or another predefined action representation, may serve as the prediction target. Derived features, including dwell time, mouse speed, hover count, click count, distance travelled, event recency, elapsed time between events, cursor-movement characteristics, page or product context, category context, and scroll state, will be calculated later during feature engineering. They will not be added to or used to alter the raw event log.

Data preparation will include the following safeguards:

1. Preserve raw SQLite event logs unchanged and perform transformations on copies in a separate reproducible pipeline.
2. Define a consistent treatment for missing values and event fields that are not applicable.
3. Remove or flag invalid and duplicate records according to the documented quality checks.
4. Split data by session, rather than randomly by individual event, to prevent information from the same session appearing in both training and evaluation data.
5. Record the protocol version, logging schema version, preprocessing decisions, and feature definitions used for each dataset.

The final target labels, sequence length, model families, evaluation metrics, and train-validation-test split proportions are **[to be defined following pilot-data review]**.

## 14. Expected Outcome

The expected outcome of the pilot is a documented, privacy-conscious dataset of natural e-commerce browsing interactions and an assessment of its suitability for next-action prediction. The pilot is expected to identify which recorded signals are reliable, which actions occur frequently enough to model, and what refinements are needed in the website tracking, task design, recruitment, and preprocessing procedures.

This experiment is exploratory and preparatory. It is not intended to establish final statistical conclusions or model-performance claims. Its results will inform the design of the subsequent research stage, which may consider additional measurement modalities, including eye tracking, under a separately specified protocol.
