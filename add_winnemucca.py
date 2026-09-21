import json

with open('public/places.json', 'r') as f:
    places = json.load(f)

winnemucca = {
  "id": "91",
  "name": "Winnemucca",
  "type": "city",
  "desc": "The dusty Winnemucca road is where Johnny Cash was totin' his pack in the song's opening verse.",
  "lat": 40.9730,
  "lon": -117.7356,
  "geojson": None
}

# Insert at index 0
places.insert(0, winnemucca)

# Keep places.json minified: every visitor downloads it, and indent=2 triples
# its size (9.2 MB -> 28.7 MB). See AGENTS.md > Data Structure.
with open('public/places.json', 'w') as f:
    json.dump(places, f, separators=(',', ':'), ensure_ascii=False)

with open('functions/places.slim.json', 'w') as f:
    slim_places = [
        {"id": p["id"], "name": p["name"], "type": p["type"], "desc": p["desc"]}
        for p in places
    ]
    json.dump(slim_places, f, indent=2)
