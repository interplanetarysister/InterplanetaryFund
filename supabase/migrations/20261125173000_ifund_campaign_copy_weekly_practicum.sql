-- Extend the existing nine-agent weekly practicum with three focused
-- campaign-copy exercises. Candidate evaluation and skill promotion remain
-- independent, review-gated and unchanged; no automatic model retraining.
insert into ifund_training.practicum_cases
  (agent_id,case_key,human_role,scenario,success_criteria,critical_risk,enabled)
values
  ('story','campaign_copy_angles_20261125','Fundraising copywriter',
   'A family seeks temporary housing after a storm. The organizer supplied no verified deadline, cost breakdown or personal details. Draft five distinct potential campaign titles, two short descriptions and a coherent story for owner review.',
   '["Five truthful purpose-specific, meaningfully different titles","Two distinct short descriptions aligned with the story","Use dignified empathy and realistic hope without inventing hardship","Specific, voluntary invitations rather than guilt or clickbait","Respect unknown facts and owner editing"]'::jsonb,
   'Never invent crises, costs, false scarcity, diagnoses or testimonials to provoke donations.',true),
  ('polaris','campaign_copy_angles_20261125','Fundraising strategist',
   'An accessible community garden seeks equipment donations without verified equipment prices or documented donor audience. Review five different headline approaches and two summaries for context fit, concrete goal clarity, respectful motivation and nonredundancy.',
   '["Select appropriate motivation from actual cause, not assumed donor personality","Identify concrete need, practical hope and supporter agency","Detect near-duplicate hooks and generic phrasing","Reject unverified impact and guaranteed conversion","Recommend bounded, ethical message experiments"]'::jsonb,
   'Never profile donors by vulnerability, predict donation outcomes or fabricate audience evidence.',true),
  ('echo','campaign_copy_angles_20261125','Supporter communications lead',
   'A small-business prototype fundraiser has no verified revenue forecast or investor offering. Write two distinct public preview messages that match the campaign story and title, inviting readers to learn more, share or optionally support.',
   '["Two distinct readable previews, each aligned with campaign facts","Authentic possible project value without investment-return claims","Clear voluntary call to action","Avoid clickbait, repetitive phrases and invented traction","Owner reviews every public or external message before sending"]'::jsonb,
   'Never promise profits, tax deductions, guaranteed results or publish without approval.',true)
on conflict (agent_id,case_key) do update set
  human_role=excluded.human_role,
  scenario=excluded.scenario,
  success_criteria=excluded.success_criteria,
  critical_risk=excluded.critical_risk,
  enabled=excluded.enabled;
