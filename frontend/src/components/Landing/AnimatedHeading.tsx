import { useEffect, useState, type CSSProperties } from 'react';

interface AnimatedHeadingProps {
  text: string;
  className?: string;
  style?: CSSProperties;
  initialDelay?: number;
  charDelay?: number;
  duration?: number;
  /** Use 'word' for scripts like Devanagari, where splitting into characters breaks glyph shaping. */
  splitBy?: 'char' | 'word';
}

export default function AnimatedHeading({
  text,
  className = '',
  style,
  initialDelay = 200,
  charDelay = 30,
  duration = 500,
  splitBy = 'char',
}: AnimatedHeadingProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), initialDelay);
    return () => clearTimeout(timer);
  }, [initialDelay]);

  const lines = text.split('\n');

  const renderUnit = (unit: string, unitIndex: number, lineIndex: number, lineLength: number) => {
    const delay = lineIndex * lineLength * charDelay + unitIndex * charDelay;
    return (
      <span
        key={unitIndex}
        className="inline-block"
        style={{
          opacity: animate ? 1 : 0,
          transform: animate ? 'translateX(0)' : 'translateX(-18px)',
          transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {unit === ' ' ? '\u00A0' : unit}
      </span>
    );
  };

  return (
    <h1 className={className} style={style} aria-label={lines.join(' ')}>
      {lines.map((line, lineIndex) => {
        const segments = line.split(/( )/).filter(Boolean);

        if (splitBy === 'word') {
          return (
            <span key={lineIndex} className="block" aria-hidden="true">
              {segments.map((segment, i) => renderUnit(segment, i, lineIndex, segments.length))}
            </span>
          );
        }

        let offset = 0;
        return (
          <span key={lineIndex} className="block" aria-hidden="true">
            {segments.map((segment) => {
              const start = offset;
              offset += segment.length;

              if (segment === ' ') {
                return renderUnit(segment, start, lineIndex, line.length);
              }

              // Letters of a word share a nowrap wrapper; per-letter inline-blocks would otherwise wrap mid-word.
              return (
                <span key={start} className="inline-block whitespace-nowrap">
                  {segment.split('').map((char, i) => renderUnit(char, start + i, lineIndex, line.length))}
                </span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}
