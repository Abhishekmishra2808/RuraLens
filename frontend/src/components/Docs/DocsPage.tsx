import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DOC_GROUPS, DOC_SECTIONS, type DocBlock, type DocCell, type Localized } from './docsContent';

interface DocsPageProps {
  section: string;
  onBack: () => void;
  onGetStarted: () => void;
}

const HEADER_OFFSET = 96;

function renderInline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-neutral-800/80 px-1.5 py-0.5 font-mono text-[0.85em] text-neutral-100">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-medium text-neutral-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export default function DocsPage({ section, onBack, onGetStarted }: DocsPageProps) {
  const { lang, toggleLang } = useLanguage();
  const hi = lang === 'hi';
  const tx = (value: Localized) => value[lang];
  const [activeId, setActiveId] = useState(section);
  const isFirstScroll = useRef(true);

  const scrollToSection = useCallback((id: string, smooth: boolean) => {
    const target = document.getElementById(id);
    if (!target) return;
    const top = id === DOC_SECTIONS[0].id ? 0 : target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    setActiveId(id);
    window.history.replaceState(null, '', `#/docs/${id}`);
  }, []);

  useEffect(() => {
    scrollToSection(section, !isFirstScroll.current);
    isFirstScroll.current = false;
  }, [section, scrollToSection]);

  useEffect(() => {
    document.documentElement.classList.add('docs-mode');
    return () => document.documentElement.classList.remove('docs-mode');
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        let current = DOC_SECTIONS[0].id;
        if (atBottom) {
          current = DOC_SECTIONS[DOC_SECTIONS.length - 1].id;
        } else {
          for (const { id } of DOC_SECTIONS) {
            const element = document.getElementById(id);
            if (element && element.getBoundingClientRect().top <= HEADER_OFFSET + 24) current = id;
          }
        }
        setActiveId((previous) => {
          if (previous !== current) window.history.replaceState(null, '', `#/docs/${current}`);
          return current;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const renderCell = (cell: DocCell) => {
    if (typeof cell === 'string') return cell;
    if ('code' in cell) {
      return <code className="whitespace-nowrap font-mono text-[13px] text-neutral-100">{cell.code}</code>;
    }
    return renderInline(tx(cell));
  };

  const renderBlock = (block: DocBlock, index: number) => {
    switch (block.kind) {
      case 'p':
        return (
          <p key={index} className="mt-4 leading-7 text-neutral-300">
            {renderInline(tx(block.text))}
          </p>
        );
      case 'h3':
        return (
          <h3 key={index} className={`mt-10 text-lg font-medium text-neutral-50 ${hi ? '' : 'tracking-tight'}`}>
            {renderInline(tx(block.text))}
          </h3>
        );
      case 'list':
      case 'steps': {
        const ListTag = block.kind === 'list' ? 'ul' : 'ol';
        return (
          <ListTag
            key={index}
            className={`mt-4 space-y-2 pl-5 leading-7 text-neutral-300 marker:text-neutral-500 ${
              block.kind === 'list' ? 'list-disc' : 'list-decimal'
            }`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                {renderInline(tx(item))}
              </li>
            ))}
          </ListTag>
        );
      }
      case 'table':
        return (
          <div key={index} className="mt-6 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-neutral-900">
                <tr>
                  {block.columns.map((column, columnIndex) => (
                    <th key={columnIndex} className="px-4 py-3 font-medium text-neutral-400">
                      {tx(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-neutral-800">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={`px-4 py-3 align-top leading-6 ${cellIndex === 0 ? 'text-neutral-100' : 'text-neutral-300'}`}
                      >
                        {renderCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'code':
        return (
          <div key={index} className="mt-6 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-4 py-2 font-mono text-xs text-neutral-400">{block.label}</div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-neutral-200">
              <code>{block.code}</code>
            </pre>
          </div>
        );
      case 'note':
        return (
          <p key={index} className="mt-6 border-l-2 border-neutral-600 pl-4 text-sm leading-6 text-neutral-400">
            {renderInline(tx(block.text))}
          </p>
        );
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-neutral-300 antialiased">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex items-center gap-2" aria-label={hi ? 'होम पेज पर जाएं' : 'Go to home page'}>
              <img src="/ruralens-logo.png" alt="" className="h-7 w-7 object-contain" />
              <span className="text-lg font-semibold tracking-tight text-neutral-50">RuraLens</span>
            </button>
            <span className="h-5 w-px bg-neutral-700" />
            <span className="text-sm text-neutral-400">{hi ? 'दस्तावेज़' : 'Documentation'}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onBack}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-neutral-50 sm:flex"
            >
              <ArrowLeft size={16} />
              {hi ? 'होम' : 'Home'}
            </button>
            <button
              onClick={toggleLang}
              aria-label={hi ? 'Switch to English' : 'Switch to Hindi'}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500"
            >
              {hi ? 'EN' : 'हि'}
            </button>
            <button
              onClick={onGetStarted}
              className="rounded-lg bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
            >
              {hi ? 'प्लेटफॉर्म खोलें' : 'Enter Platform'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl px-6 lg:px-8">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-neutral-800 py-10 pr-6 lg:block">
          <nav aria-label={hi ? 'दस्तावेज़ अनुभाग' : 'Documentation sections'}>
            {DOC_GROUPS.map((group) => (
              <div key={group.title.en} className="mb-8">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">{tx(group.title)}</p>
                <ul className="space-y-1 border-l border-neutral-800">
                  {group.sections.map((docSection) => {
                    const active = activeId === docSection.id;
                    return (
                      <li key={docSection.id}>
                        <a
                          href={`#/docs/${docSection.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            scrollToSection(docSection.id, true);
                          }}
                          aria-current={active ? 'location' : undefined}
                          className={`-ml-px block border-l py-1 pl-4 text-sm transition-colors ${
                            active
                              ? 'border-neutral-50 font-medium text-neutral-50'
                              : 'border-transparent text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                          }`}
                        >
                          {tx(docSection.title)}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 py-10 lg:pl-12">
          <label className="mb-8 block lg:hidden">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              {hi ? 'अनुभाग पर जाएं' : 'Jump to section'}
            </span>
            <select
              value={activeId}
              onChange={(event) => scrollToSection(event.target.value, true)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            >
              {DOC_GROUPS.map((group) => (
                <optgroup key={group.title.en} label={tx(group.title)}>
                  {group.sections.map((docSection) => (
                    <option key={docSection.id} value={docSection.id}>
                      {tx(docSection.title)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <article className="max-w-3xl">
            {DOC_SECTIONS.map((docSection, sectionIndex) => (
              <section
                key={docSection.id}
                id={docSection.id}
                aria-labelledby={`${docSection.id}-title`}
                className={sectionIndex === 0 ? 'pb-14' : 'border-t border-neutral-800 py-14'}
              >
                <h2
                  id={`${docSection.id}-title`}
                  className={`font-medium text-neutral-50 ${sectionIndex === 0 ? 'text-4xl md:text-5xl' : 'text-3xl'} ${
                    hi ? '' : 'tracking-tight'
                  }`}
                >
                  {tx(docSection.title)}
                </h2>
                <p className="mt-4 text-lg leading-8 text-neutral-400">{renderInline(tx(docSection.summary))}</p>
                {docSection.blocks.map(renderBlock)}
              </section>
            ))}

            <footer className="flex flex-col gap-4 border-t border-neutral-800 py-10 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-500">
                {hi ? 'RuraLens · MIT लाइसेंस के अंतर्गत' : 'RuraLens · Released under the MIT License'}
              </p>
              <button
                onClick={onGetStarted}
                className="self-start rounded-lg bg-neutral-50 px-5 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
              >
                {hi ? 'प्लेटफॉर्म खोलें' : 'Enter Platform'}
              </button>
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}
