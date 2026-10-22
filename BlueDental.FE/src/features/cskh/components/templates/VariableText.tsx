/** Same token the server's MessageTemplateRenderer finds; the capture keeps it in split(). */
const VARIABLE_TOKEN = /(\{[a-z0-9_]+\})/;

/** Message text with every `{bien}` drawn as a chip. */
export function VariableText({ text }: { text: string }) {
  const parts = text.split(VARIABLE_TOKEN);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="tpl-var">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
