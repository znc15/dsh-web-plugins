/**
 * session-delete locale dictionaries. The delete affordance lives in the
 * conversation header action row; all copy is localized through the
 * standard `t` seat.
 */

/** Copy keys owned by this plugin. */
export type SessionDeleteKey =
  | 'delete.label'
  | 'delete.hint'
  | 'delete.confirmTitle'
  | 'delete.confirmDescription'
  | 'delete.acknowledge'
  | 'delete.cancel'
  | 'delete.confirm'
  | 'delete.deleting'
  | 'delete.busy'
  | 'delete.failed'

/** Simplified Chinese dictionary (key source). */
export const zh: Record<SessionDeleteKey, string> = {
  'delete.label': '删除对话',
  'delete.hint': '永久删除当前对话（含日志文件）',
  'delete.confirmTitle': '删除这个对话？',
  'delete.confirmDescription': '这会从列表中移除当前对话，并永久删除它的日志文件，操作无法撤销。正在运行的对话无法删除。',
  'delete.acknowledge': '我了解这是永久删除',
  'delete.cancel': '取消',
  'delete.confirm': '永久删除',
  'delete.deleting': '删除中…',
  'delete.busy': '对话正在运行，暂时无法删除',
  'delete.failed': '删除失败，请稍后重试',
}

/** English dictionary, checked complete against the zh key set. */
export const en: Record<SessionDeleteKey, string> = {
  'delete.label': 'Delete conversation',
  'delete.hint': 'Permanently delete this conversation (including its log files)',
  'delete.confirmTitle': 'Delete this conversation?',
  'delete.confirmDescription': 'This removes the current conversation from the list and permanently deletes its log files. This cannot be undone. Running conversations cannot be deleted.',
  'delete.acknowledge': 'I understand this is permanent',
  'delete.cancel': 'Cancel',
  'delete.confirm': 'Delete permanently',
  'delete.deleting': 'Deleting…',
  'delete.busy': 'The conversation is running and cannot be deleted right now',
  'delete.failed': 'Deletion failed, please try again later',
}
