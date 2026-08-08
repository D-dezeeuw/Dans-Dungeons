// src/ai/acts.js — generate the next act of the campaign (Epic E7.S2).
//
// A campaign is generated one act at a time rather than all at once. That is
// what makes an 80-hour red thread affordable AND responsive: the generator
// sees what actually happened — which factions the player angered, what the
// Game Master invented along the way, which clues are still unpaid — so the
// story bends toward the campaign the player is really having.

import { chatCompletion } from './client.js';
import { ACT_SCHEMA } from './schemas.js';
import { validateAct } from './validate.js';
import { t, locale } from '../i18n/i18n.js';

export async function generateAct(context) {
  try {
    // Validated on receipt: an act with no beats, or beats sharing an id, is
    // worse than no act — it leaves the campaign with a title, a premise, and
    // nothing to do, and `requires` stops resolving to one beat.
    return validateAct(await chatCompletion({
      tier: 'medium',
      maxTokens: 1600,
      messages: [
        { role: 'system', content: t('ai.actPrompt', {
            language:  locale() === 'nl' ? 'Dutch' : 'English',
            actNumber: context.actNumber,
            finale:    context.finalAct ? t('ai.actFinaleNote') : '',
            context:   JSON.stringify(context),
          }) },
        { role: 'user', content: t('ai.actUserMsg') },
      ],
      schema: ACT_SCHEMA,
    }));
  } catch {
    return null;
  }
}
