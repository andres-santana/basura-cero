import type { Manual, ManualBlock } from "@/lib/manuals";

/**
 * Renderiza un manual (alumno o maestro) como HTML accesible, responsive e
 * imprimible. El tono visual se ajusta por audiencia: la variante "alumno"
 * usa tipografia mas grande y la paleta eco; la de "maestro" es mas sobria.
 */
export function ManualContent({ manual }: { manual: Manual }) {
  const isKid = manual.audience === "alumno";

  return (
    <article className={isKid ? "text-slate-800" : "text-slate-700"}>
      <header className="mb-8">
        <h1
          className={
            isKid
              ? "font-display text-3xl font-black text-eco-700 sm:text-4xl"
              : "text-3xl font-bold text-emerald-700"
          }
        >
          {manual.title}
        </h1>
        <p className="mt-1 text-sm font-semibold text-emerald-600">{manual.subtitle}</p>
        <p className={isKid ? "mt-4 text-lg leading-relaxed" : "mt-4 text-base leading-relaxed"}>
          {manual.intro}
        </p>
      </header>

      <div className="space-y-10">
        {manual.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`}>
            <h2
              id={`${section.id}-h`}
              className={
                isKid
                  ? "font-display text-2xl font-black text-eco-700"
                  : "text-xl font-bold text-emerald-800"
              }
            >
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, i) => (
                <ManualBlockView key={i} block={block} isKid={isKid} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function ManualBlockView({ block, isKid }: { block: ManualBlock; isKid: boolean }) {
  const textSize = isKid ? "text-lg" : "text-base";

  switch (block.type) {
    case "paragraph":
      return <p className={`${textSize} leading-relaxed`}>{block.text}</p>;

    case "bullets":
      return (
        <ul className={`${textSize} ml-5 list-disc space-y-1.5 leading-relaxed`}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case "steps":
      return (
        <ol className={`${textSize} ml-5 list-decimal space-y-1.5 font-medium leading-relaxed marker:font-bold marker:text-emerald-600`}>
          {block.items.map((item, i) => (
            <li key={i} className="font-normal">
              {item}
            </li>
          ))}
        </ol>
      );

    case "callout": {
      const tone =
        block.tone === "amber"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-eco-200 bg-eco-50 text-eco-900";
      const label = block.tone === "amber" ? "text-amber-700" : "text-eco-700";
      return (
        <div className={`rounded-2xl border-2 ${tone} px-4 py-3 ${textSize} leading-relaxed`}>
          <span className={`font-bold ${label}`}>{block.label} </span>
          {block.text}
        </div>
      );
    }

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse overflow-hidden rounded-xl text-left text-sm">
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="bg-emerald-600 px-3 py-2 font-semibold text-white"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                  {row.map((cell, j) => (
                    <td key={j} className="border-t border-slate-200 px-3 py-2 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}
