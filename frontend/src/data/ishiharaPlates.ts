import type { IshiharaPlate } from '../types/colorVision';

/**
 * 真实石原氏测试板标准答案（按用户提供的图库写死）。
 * 图片放置在 public/ishihara/plate-01.png ~ plate-08.png。
 */
export const ishiharaAnswers = [
  { id: 1, normal: '16', redGreenBlind: '0' },   // 正常看 16
  { id: 2, normal: '74', redGreenBlind: '21' },  // 正常看 74，红绿盲看 21
  { id: 3, normal: '36', redGreenBlind: '36' },  // 正常看 36
  { id: 4, normal: '25', redGreenBlind: '25' },  // 正常看 25
  { id: 5, normal: '6', redGreenBlind: '0' },    // 正常看 6
  { id: 6, normal: '689', redGreenBlind: '0' },  // 正常看 689，红绿盲可能看不到
  { id: 7, normal: '3', redGreenBlind: '0' },    // 正常看 3
  { id: 8, normal: '88', redGreenBlind: '0' },   // 正常看 88
] as const;

const NOTES: Record<number, string> = {
  1: '正常视觉看到 16，红绿色盲通常看不到。',
  2: '正常视觉看到 74，红绿色盲常读成 21。',
  3: '正常视觉与红绿色盲均可看到 36，作为对照板。',
  4: '正常视觉与红绿色盲均可看到 25，作为对照板。',
  5: '正常视觉看到 6，红绿色盲通常看不到。',
  6: '正常视觉看到 689，红绿色盲通常看不到。',
  7: '正常视觉看到 3，红绿色盲通常看不到。',
  8: '正常视觉看到 88，红绿色盲通常看不到。',
};

const BASE_URL = ((import.meta as unknown as {
  env?: { BASE_URL?: string }
}).env?.BASE_URL ?? '/').replace(/\/$/, '');

export const ISHIHARA_PLATES: IshiharaPlate[] = ishiharaAnswers.map(item => ({
  id: item.id,
  image: `${BASE_URL}/ishihara/plate-${String(item.id).padStart(2, '0')}.png`,
  normal: item.normal,
  redGreenBlind: item.redGreenBlind,
  note: NOTES[item.id],
}));
