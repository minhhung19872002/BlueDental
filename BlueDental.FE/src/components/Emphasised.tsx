/** A bold phrase inside a sentence, as the BA's mocks mark it with `**…**`. */
export function Emphasised({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}
    </>
  );
}
