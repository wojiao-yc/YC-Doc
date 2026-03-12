export const BLOCK_TYPES = {
  PARAGRAPH: "paragraph",
  HEADING: "heading",
  BULLET_LIST_ITEM: "bullet_list_item",
  ORDERED_LIST_ITEM: "ordered_list_item",
  TASK_LIST_ITEM: "task_list_item",
  BLOCKQUOTE: "blockquote",
  CODE_BLOCK: "code_block",
  IMAGE: "image",
  MATH_BLOCK: "math_block",
  THEMATIC_BREAK: "thematic_break",
  TABLE: "table",
  HTML_BLOCK: "html_block"
};

export const BLOCK_TYPE_LIST = Object.freeze(Object.values(BLOCK_TYPES));
export const DEFAULT_BLOCK_TYPE = BLOCK_TYPES.PARAGRAPH;

export const isBlockType = (value) => BLOCK_TYPE_LIST.includes(String(value || ""));
