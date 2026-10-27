"""Extract embedded JSON props (initialMatches, topAgents, summary, etc.) from captured HTML."""
import re, sys, json
sys.stdout.reconfigure(encoding="utf-8")

html = open("docs/research/valosmurf-app-main.html", encoding="utf-8").read()
unesc = html.replace('\\"', '"').replace('\\\\', '\\')

def extract_array(key):
    i = unesc.find(f'"{key}"')
    if i < 0:
        return None
    j = unesc.find("[", i)
    if j < 0:
        return None
    depth = 0
    for k in range(j, min(len(unesc), j + 10_000_000)):
        c = unesc[k]
        if c == "[": depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(unesc[j:k+1])
                except Exception as e:
                    return {"_parse_error": str(e), "_raw_head": unesc[j:j+400]}
    return None

def extract_obj(key):
    i = unesc.find(f'"{key}"')
    if i < 0:
        return None
    j = unesc.find("{", i)
    if j < 0:
        return None
    depth = 0
    for k in range(j, min(len(unesc), j + 10_000_000)):
        c = unesc[k]
        if c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(unesc[j:k+1])
                except Exception as e:
                    return {"_parse_error": str(e), "_raw_head": unesc[j:j+400]}
    return None

out = {}
for key in ["topAgents", "initialMatches", "teammates", "summary", "stats", "player", "profile", "seasonRanks", "analytics"]:
    res = extract_array(key)
    if res is None:
        res = extract_obj(key)
    if res is not None:
        out[key] = res
        print(key, "->", (len(res) if isinstance(res, list) else "obj"), (res[0] if isinstance(res, list) and res else list(res)[:10]))

# find any other keys like "xxxMatches" / "initialXxx"
for m in sorted(set(re.findall(r'"((?:initial|top|all|season|match|player|summary|teammate|analytic|account)[A-Za-z]*)":', unesc))):
    print("key seen:", m)

json.dump(out, open("docs/research/meiy-profile-data.json", "w", encoding="utf-8"), ensure_ascii=False)
print("saved docs/research/meiy-profile-data.json")
