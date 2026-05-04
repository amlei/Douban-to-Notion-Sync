import type { PluggableList } from "unified";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { rehypeSplitWordsIntoSpans } from "../rehype";

export const streamdownPlugins: {
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
} = {
  remarkPlugins: [
    remarkGfm,
    [remarkMath, { singleDollarTextMath: true }],
  ],
  rehypePlugins: [
    rehypeRaw,
    [rehypeKatex, { output: "html" }],
  ],
};

export const streamdownPluginsWithWordAnimation: {
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
} = {
  remarkPlugins: [
    remarkGfm,
    [remarkMath, { singleDollarTextMath: true }],
  ],
  rehypePlugins: [
    [rehypeKatex, { output: "html" }],
    rehypeSplitWordsIntoSpans,
  ],
};

export const reasoningPlugins: {
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
} = {
  remarkPlugins: streamdownPlugins.remarkPlugins,
  rehypePlugins: [
    [rehypeKatex, { output: "html" }],
  ],
};

export const humanMessagePlugins: {
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
} = {
  remarkPlugins: [
    [remarkMath, { singleDollarTextMath: true }],
  ],
  rehypePlugins: [
    [rehypeKatex, { output: "html" }],
  ],
};
