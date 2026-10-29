import re
import urllib.request

URL = (
    "http://localhost:3002/valorant/profile/riot/Meiy%23B3L/overview"
    "?platform=pc&playlist=competitive&season=latest"
)
html = urllib.request.urlopen(URL, timeout=120).read().decode("utf-8")
print("len", len(html))
for pat in ["kt-bestmap", "/maps/", "kt-roles", "roles/", "/agents/"]:
    print(pat, len(re.findall(re.escape(pat), html)))

imgs = re.findall(r'<img[^>]*src="([^"]*)"[^>]*>', html)
map_imgs = [i for i in imgs if "/maps/" in i]
print("map imgs:", map_imgs[:5])
role_imgs = [i for i in imgs if "/roles/" in i]
print("role imgs:", role_imgs[:5])

i = html.find("kt-roles")
print("--- roles ---")
print(re.sub(r"><", ">\n<", html[i : i + 1200]))
