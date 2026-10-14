'use strict';
const sanitize = require('sanitize-html');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function legacyHtml(value) {
  return sanitize(String(value || ''), {
    allowedTags: ['article','section','div','span','p','h1','h2','h3','h4','strong','b','em','i','small','br','hr','a','img','figure','figcaption','ul','ol','li','table','thead','tbody','tr','th','td','details','summary','blockquote'],
    allowedAttributes: { '*':['class','id','aria-label'], a:['href','title'], img:['src','alt','width','height','loading','decoding'], th:['scope','colspan','rowspan'], td:['colspan','rowspan'] },
    allowedSchemes: ['https','mailto','tel'], allowProtocolRelative:false,
    transformTags: {
      img: (tag, attrs) => ({ tagName:tag, attribs:{ ...attrs, src: /^\/(?!\/)/.test(attrs.src || '') ? attrs.src : (/^https:\/\//.test(attrs.src || '') ? attrs.src : '') } })
    }
  });
}
function blocksHtml(blocks) {
  return blocks.map(block => block.type === 'image'
    ? `<figure><img src="${escape(block.src)}" alt="${escape(block.alt)}" loading="lazy">${block.caption ? `<figcaption>${escape(block.caption)}</figcaption>` : ''}</figure>`
    : `<${block.type === 'heading' ? 'h2' : 'p'}>${escape(block.text).replace(/\n/g,'<br>')}</${block.type === 'heading' ? 'h2' : 'p'}>`).join('\n');
}
module.exports = { escape, legacyHtml, blocksHtml };
