/**
 * 按写死的标准答案判分：
 * - 8 个输入全部等于 normal → 视觉正常
 * - 1/2/5/6/7/8 任一题填 0 或填错（含把 74 填成 21）→ 红绿色盲/色弱
 * - 其余未匹配情况也按红绿色盲/色弱处理，避免漏判
 */

import type { CBDetectionResult, IshiharaPlate } from '../../types/colorVision';

const CRITICAL_IDS = [1, 2, 5, 6, 7, 8];

export function scoreIshiharaAnswers(
  plates: IshiharaPlate[],
  answers: Record<number, number>,
): CBDetectionResult {
  let correct_count = 0;
  let answered_count = 0;
  let critical_error_count = 0;
  let mismatch_count = 0;

  for (const plate of plates) {
    const raw = answers[plate.id];
    const answer = raw === undefined ? '' : String(raw);
    if (raw !== undefined) answered_count += 1;

    const matched = answer === plate.normal;
    if (matched) correct_count += 1;
    else mismatch_count += 1;

    if (CRITICAL_IDS.includes(plate.id) && !matched) {
      critical_error_count += 1;
    }
  }

  const isNormal = mismatch_count === 0 && answered_count === plates.length;
  const isRedGreen = !isNormal && (critical_error_count > 0 || mismatch_count > 0);

  const detected_type = isRedGreen ? 'deuteranopia' : 'none';
  const result_label = isNormal ? '视觉正常' : isRedGreen ? '红绿色盲/色弱' : '视觉正常';

  const abnormalRatio = plates.length ? mismatch_count / plates.length : 0;
  const confidence = isNormal ? 1 : Math.round(Math.max(abnormalRatio, critical_error_count / plates.length) * 100) / 100;
  const severity = isNormal
    ? '无异常'
    : confidence >= 0.6 ? '明显' : confidence >= 0.3 ? '中度' : '轻度';

  return {
    detected_type,
    result_label,
    severity,
    confidence,
    score_breakdown: {
      none: correct_count,
      protanopia: isRedGreen ? critical_error_count : 0,
      deuteranopia: isRedGreen ? mismatch_count : 0,
      tritanopia: 0,
    },
    correct_count,
    answered_count,
  };
}
