"use client";

import { useRef, useState, type FormEvent } from "react";
import { imageSearchProfilePath, parseImageRiotId, type ImageSearchCandidates } from "@/lib/image-search-core";
import type { Dict } from "@/lib/i18n/dict";

export function ImageSearchResults({ result, t, navigate }: {
  result: ImageSearchCandidates;
  t: Dict["search"];
  navigate: (path: string) => void;
}) {
  const first = result.pairs[0];
  const [edit, setEdit] = useState(first ? `${first.name}#${first.tag}` : result.names[0] ? `${result.names[0]}#` : "");
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function choose(value: string) {
    setEdit(value);
    setInvalid(false);
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const id = parseImageRiotId(edit);
    if (!id) { setInvalid(true); return; }
    navigate(imageSearchProfilePath(id));
  }

  return (
    <form onSubmit={submit} className="kt-image-results">
      <h3 className="font-bold">{result.pairs.length ? t.imagePick : t.imageNone}</h3>
      <div className="kt-image-candidates">
        {result.pairs.map((pair) => {
          const id = `${pair.name}#${pair.tag}`;
          return <button key={id} type="button" onClick={() => choose(id)}>{id}</button>;
        })}
        {result.names.map((name) => (
          <button key={`name:${name}`} type="button" onClick={() => choose(`${name}#`)}>{name}</button>
        ))}
      </div>
      <p id="image-search-review" className="text-sm text-secondary">{t.imageReview}</p>
      <label htmlFor="image-search-id" className="text-sm">{t.imageEdit}</label>
      <div className="kt-image-edit">
        <input id="image-search-id" ref={input} value={edit} placeholder="Name#TAG" autoComplete="off"
          aria-describedby="image-search-review" aria-invalid={invalid}
          onChange={(event) => { setEdit(event.target.value); setInvalid(false); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
              event.preventDefault();
              event.stopPropagation();
            }
          }} />
        <button type="submit" className="trn-button trn-button--action">{t.imageConfirm}</button>
      </div>
      {invalid && <p role="alert" className="kt-image-error">{t.imageInvalidId}</p>}
    </form>
  );
}
