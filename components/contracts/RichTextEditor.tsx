'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { useEffect } from 'react'
import { subscriptionQuoteTableHtml } from '@/lib/subscription-quote'
import { PageBreak } from './PageBreak'
import { FontSize } from './FontSize'
import styles from './RichTextEditor.module.css'

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

const FONT_SIZES = [
  { label: 'Default', value: '' },
  { label: '10', value: '10px' },
  { label: '11', value: '11px' },
  { label: '12', value: '12px' },
  { label: '13', value: '13px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
]

export default function RichTextEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class: styles.table,
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: { class: styles.tableCell },
      }),
      TableCell.configure({
        HTMLAttributes: { class: styles.tableCell },
      }),
      PageBreak,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: styles.editorContent },
      handleKeyDown: (view, event) => {
        // Ctrl/Cmd+A inside a table → select every cell (so copy works)
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
          const { state } = view
          const $from = state.selection.$from
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'table') {
              const table = $from.node(d)
              const tableStart = $from.before(d)
              const map = TableMap.get(table)
              const firstCell = tableStart + map.map[0] + 1
              const lastCell =
                tableStart + map.map[map.map.length - 1] + 1
              view.dispatch(
                state.tr.setSelection(
                  CellSelection.create(state.doc, firstCell, lastCell)
                )
              )
              return true
            }
          }
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content, editor])

  if (!editor) return null

  const ToolBtn = ({
    onClick,
    active,
    title,
    children,
    disabled,
  }: {
    onClick: () => void
    active?: boolean
    title: string
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={e => {
        e.preventDefault()
        onClick()
      }}
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
    >
      {children}
    </button>
  )

  const inTable = editor.isActive('table')
  const currentFontSize =
    (editor.getAttributes('textStyle').fontSize as string | undefined) ?? ''

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <ToolBtn
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn
          title="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolBtn>
        <ToolBtn
          title="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </ToolBtn>

        <select
          className={styles.fontSizeSelect}
          title="Font size"
          value={currentFontSize}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => {
            const v = e.target.value
            if (!v) {
              editor.chain().focus().unsetFontSize().run()
            } else {
              editor.chain().focus().setFontSize(v).run()
            }
          }}
        >
          {FONT_SIZES.map(s => (
            <option key={s.label} value={s.value}>
              {s.value ? `${s.label}px` : s.label}
            </option>
          ))}
        </select>

        <div className={styles.divider} />

        <ToolBtn
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolBtn>
        <ToolBtn
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolBtn>
        <ToolBtn
          title="Paragraph"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          ¶
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •—
        </ToolBtn>
        <ToolBtn
          title="Ordered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn
          title="Insert table (3×3)"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          Table
        </ToolBtn>
        <ToolBtn
          title="Insert subscription quote table (with {{variables}})"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent(subscriptionQuoteTableHtml())
              .run()
          }
        >
          Sub table
        </ToolBtn>
        <ToolBtn
          title="Add column after"
          disabled={!inTable}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          +Col
        </ToolBtn>
        <ToolBtn
          title="Add row after"
          disabled={!inTable}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          +Row
        </ToolBtn>
        <ToolBtn
          title="Delete column"
          disabled={!inTable}
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          −Col
        </ToolBtn>
        <ToolBtn
          title="Delete row"
          disabled={!inTable}
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          −Row
        </ToolBtn>
        <ToolBtn
          title="Delete table"
          disabled={!inTable}
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          −Table
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn
          title="Insert page break (for PDF / print)"
          onClick={() => editor.chain().focus().setPageBreak().run()}
        >
          Page ↵
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn
          title="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          ←
        </ToolBtn>
        <ToolBtn
          title="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          ↔
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          ↩
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          ↪
        </ToolBtn>
      </div>

      <EditorContent editor={editor} className={styles.editorWrap} />
    </div>
  )
}
