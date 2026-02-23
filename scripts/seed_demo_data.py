"""
Seed real FIFA World Cup 2026 data — 48 teams, players, 72 group stage matches.

Run from project root:
    cd apps/backend
    source .venv/bin/activate
    source .env
    PYTHONPATH=$(pwd) python ../../scripts/seed_demo_data.py
"""
import uuid
from datetime import datetime

from app.core.db import SessionLocal
from app.models.team import Team
from app.models.player import Player
from app.models.match import Match, MatchStatus
from app.models.round import Round

# ──────────────────────────────────────────
# All 48 teams in 12 groups (A–L)
# 6 playoff spots marked as TBD
# ──────────────────────────────────────────
TEAMS = [
    # Group A
    {"name": "Mexico", "code": "MX", "group": "A"},
    {"name": "South Africa", "code": "ZA", "group": "A"},
    {"name": "South Korea", "code": "KR", "group": "A"},
    {"name": "TBD (UEFA Path D)", "code": "UD", "group": "A"},
    # Group B
    {"name": "Canada", "code": "CA", "group": "B"},
    {"name": "TBD (UEFA Path A)", "code": "UA", "group": "B"},
    {"name": "Qatar", "code": "QA", "group": "B"},
    {"name": "Switzerland", "code": "CH", "group": "B"},
    # Group C
    {"name": "Brazil", "code": "BR", "group": "C"},
    {"name": "Morocco", "code": "MA", "group": "C"},
    {"name": "Haiti", "code": "HT", "group": "C"},
    {"name": "Scotland", "code": "SC", "group": "C"},
    # Group D
    {"name": "United States", "code": "US", "group": "D"},
    {"name": "Paraguay", "code": "PY", "group": "D"},
    {"name": "Australia", "code": "AU", "group": "D"},
    {"name": "TBD (UEFA Path C)", "code": "UC", "group": "D"},
    # Group E
    {"name": "Germany", "code": "DE", "group": "E"},
    {"name": "Curaçao", "code": "CW", "group": "E"},
    {"name": "Ivory Coast", "code": "CI", "group": "E"},
    {"name": "Ecuador", "code": "EC", "group": "E"},
    # Group F
    {"name": "Netherlands", "code": "NL", "group": "F"},
    {"name": "Japan", "code": "JP", "group": "F"},
    {"name": "TBD (UEFA Path B)", "code": "UB", "group": "F"},
    {"name": "Tunisia", "code": "TN", "group": "F"},
    # Group G
    {"name": "Belgium", "code": "BE", "group": "G"},
    {"name": "Egypt", "code": "EG", "group": "G"},
    {"name": "Iran", "code": "IR", "group": "G"},
    {"name": "New Zealand", "code": "NZ", "group": "G"},
    # Group H
    {"name": "Spain", "code": "ES", "group": "H"},
    {"name": "Cape Verde", "code": "CV", "group": "H"},
    {"name": "Saudi Arabia", "code": "SA", "group": "H"},
    {"name": "Uruguay", "code": "UY", "group": "H"},
    # Group I
    {"name": "France", "code": "FR", "group": "I"},
    {"name": "Senegal", "code": "SN", "group": "I"},
    {"name": "TBD (Intercontinental 2)", "code": "I2", "group": "I"},
    {"name": "Norway", "code": "NO", "group": "I"},
    # Group J
    {"name": "Argentina", "code": "AR", "group": "J"},
    {"name": "Algeria", "code": "DZ", "group": "J"},
    {"name": "Austria", "code": "AT", "group": "J"},
    {"name": "Jordan", "code": "JO", "group": "J"},
    # Group K
    {"name": "Portugal", "code": "PT", "group": "K"},
    {"name": "TBD (Intercontinental 1)", "code": "I1", "group": "K"},
    {"name": "Uzbekistan", "code": "UZ", "group": "K"},
    {"name": "Colombia", "code": "CO", "group": "K"},
    # Group L
    {"name": "England", "code": "GB", "group": "L"},
    {"name": "Croatia", "code": "HR", "group": "L"},
    {"name": "Ghana", "code": "GH", "group": "L"},
    {"name": "Panama", "code": "PA", "group": "L"},
]

# ──────────────────────────────────────────
# Stadium name mapping
# ──────────────────────────────────────────
VENUES = {
    "mexico_city": "Estadio Azteca, Mexico City",
    "guadalajara": "Estadio Akron, Guadalajara",
    "monterrey": "Estadio BBVA, Monterrey",
    "toronto": "BMO Field, Toronto",
    "vancouver": "BC Place, Vancouver",
    "new_york": "MetLife Stadium, New York/NJ",
    "boston": "Gillette Stadium, Boston",
    "philadelphia": "Lincoln Financial Field, Philadelphia",
    "miami": "Hard Rock Stadium, Miami",
    "atlanta": "Mercedes-Benz Stadium, Atlanta",
    "houston": "NRG Stadium, Houston",
    "dallas": "AT&T Stadium, Dallas",
    "kansas_city": "Arrowhead Stadium, Kansas City",
    "los_angeles": "SoFi Stadium, Los Angeles",
    "san_francisco": "Levi's Stadium, San Francisco",
    "seattle": "Lumen Field, Seattle",
}

# ──────────────────────────────────────────
# All 72 group stage matches (real schedule)
# Times in UTC
# ──────────────────────────────────────────
MATCHES = [
    # Match 1-2: June 11 (Opening Day)
    (1, "2026-06-11 20:00", "Mexico", "South Africa", "A", "mexico_city"),
    (2, "2026-06-12 03:00", "South Korea", "TBD (UEFA Path D)", "A", "guadalajara"),
    # Match 3-4: June 12
    (3, "2026-06-12 20:00", "Canada", "TBD (UEFA Path A)", "B", "toronto"),
    (4, "2026-06-13 01:00", "United States", "Paraguay", "D", "los_angeles"),
    # Match 5-8: June 13
    (5, "2026-06-13 22:00", "Qatar", "Switzerland", "B", "san_francisco"),
    (6, "2026-06-13 22:00", "Brazil", "Morocco", "C", "new_york"),
    (7, "2026-06-14 01:00", "Haiti", "Scotland", "C", "boston"),
    (8, "2026-06-14 04:00", "Australia", "TBD (UEFA Path C)", "D", "vancouver"),
    # Match 9-12: June 14
    (9, "2026-06-14 17:00", "Germany", "Curaçao", "E", "houston"),
    (10, "2026-06-14 20:00", "Netherlands", "Japan", "F", "dallas"),
    (11, "2026-06-14 23:00", "Ivory Coast", "Ecuador", "E", "philadelphia"),
    (12, "2026-06-15 02:00", "TBD (UEFA Path B)", "Tunisia", "F", "monterrey"),
    # Match 13-16: June 15
    (13, "2026-06-15 16:00", "Spain", "Cape Verde", "H", "atlanta"),
    (14, "2026-06-15 22:00", "Belgium", "Egypt", "G", "vancouver"),
    (15, "2026-06-15 22:00", "Saudi Arabia", "Uruguay", "H", "miami"),
    (16, "2026-06-16 01:00", "Iran", "New Zealand", "G", "los_angeles"),
    # Match 17-20: June 16
    (17, "2026-06-16 20:00", "France", "Senegal", "I", "new_york"),
    (18, "2026-06-16 23:00", "TBD (Intercontinental 2)", "Norway", "I", "boston"),
    (19, "2026-06-17 01:00", "Argentina", "Algeria", "J", "kansas_city"),
    (20, "2026-06-17 04:00", "Austria", "Jordan", "J", "san_francisco"),
    # Match 21-24: June 17
    (21, "2026-06-17 17:00", "Portugal", "TBD (Intercontinental 1)", "K", "houston"),
    (22, "2026-06-17 20:00", "England", "Croatia", "L", "dallas"),
    (23, "2026-06-17 23:00", "Ghana", "Panama", "L", "toronto"),
    (24, "2026-06-18 02:00", "Uzbekistan", "Colombia", "K", "mexico_city"),
    # Match 25-28: June 18 (Matchday 2 starts)
    (25, "2026-06-18 16:00", "TBD (UEFA Path D)", "South Africa", "A", "atlanta"),
    (26, "2026-06-18 22:00", "Switzerland", "TBD (UEFA Path A)", "B", "los_angeles"),
    (27, "2026-06-19 01:00", "Canada", "Qatar", "B", "vancouver"),
    (28, "2026-06-19 01:00", "Mexico", "South Korea", "A", "guadalajara"),
    # Match 29-32: June 19
    (29, "2026-06-19 22:00", "Scotland", "Morocco", "C", "boston"),
    (30, "2026-06-19 22:00", "United States", "Australia", "D", "seattle"),
    (31, "2026-06-20 01:00", "Brazil", "Haiti", "C", "philadelphia"),
    (32, "2026-06-20 04:00", "TBD (UEFA Path C)", "Paraguay", "D", "san_francisco"),
    # Match 33-36: June 20
    (33, "2026-06-20 17:00", "Netherlands", "TBD (UEFA Path B)", "F", "houston"),
    (34, "2026-06-20 20:00", "Germany", "Ivory Coast", "E", "toronto"),
    (35, "2026-06-21 00:00", "Ecuador", "Curaçao", "E", "kansas_city"),
    (36, "2026-06-21 03:00", "Tunisia", "Japan", "F", "monterrey"),
    # Match 37-40: June 21
    (37, "2026-06-21 16:00", "Spain", "Saudi Arabia", "H", "atlanta"),
    (38, "2026-06-21 22:00", "Belgium", "Iran", "G", "los_angeles"),
    (39, "2026-06-21 22:00", "Uruguay", "Cape Verde", "H", "miami"),
    (40, "2026-06-22 01:00", "New Zealand", "Egypt", "G", "vancouver"),
    # Match 41-44: June 22
    (41, "2026-06-22 17:00", "Argentina", "Austria", "J", "dallas"),
    (42, "2026-06-22 20:00", "France", "TBD (Intercontinental 2)", "I", "philadelphia"),
    (43, "2026-06-22 23:00", "Norway", "Senegal", "I", "new_york"),
    (44, "2026-06-23 03:00", "Jordan", "Algeria", "J", "san_francisco"),
    # Match 45-48: June 23
    (45, "2026-06-23 17:00", "Portugal", "Uzbekistan", "K", "houston"),
    (46, "2026-06-23 20:00", "England", "Ghana", "L", "boston"),
    (47, "2026-06-23 23:00", "Panama", "Croatia", "L", "toronto"),
    (48, "2026-06-24 02:00", "Colombia", "TBD (Intercontinental 1)", "K", "guadalajara"),
    # Match 49-54: June 24 (Matchday 3 — simultaneous kickoffs per group)
    (49, "2026-06-24 22:00", "Switzerland", "Canada", "B", "vancouver"),
    (50, "2026-06-24 22:00", "TBD (UEFA Path A)", "Qatar", "B", "seattle"),
    (51, "2026-06-24 22:00", "Scotland", "Brazil", "C", "miami"),
    (52, "2026-06-24 22:00", "Morocco", "Haiti", "C", "atlanta"),
    (53, "2026-06-25 01:00", "TBD (UEFA Path D)", "Mexico", "A", "mexico_city"),
    (54, "2026-06-25 01:00", "South Africa", "South Korea", "A", "monterrey"),
    # Match 55-60: June 25
    (55, "2026-06-25 20:00", "Ecuador", "Germany", "E", "new_york"),
    (56, "2026-06-25 20:00", "Curaçao", "Ivory Coast", "E", "philadelphia"),
    (57, "2026-06-26 00:00", "Japan", "TBD (UEFA Path B)", "F", "dallas"),
    (58, "2026-06-26 00:00", "Tunisia", "Netherlands", "F", "kansas_city"),
    (59, "2026-06-26 02:00", "TBD (UEFA Path C)", "United States", "D", "los_angeles"),
    (60, "2026-06-26 02:00", "Paraguay", "Australia", "D", "san_francisco"),
    # Match 61-66: June 26
    (61, "2026-06-26 20:00", "Norway", "France", "I", "boston"),
    (62, "2026-06-26 20:00", "Senegal", "TBD (Intercontinental 2)", "I", "toronto"),
    (63, "2026-06-27 00:00", "Cape Verde", "Saudi Arabia", "H", "houston"),
    (64, "2026-06-27 00:00", "Uruguay", "Spain", "H", "guadalajara"),
    (65, "2026-06-27 03:00", "Egypt", "Iran", "G", "seattle"),
    (66, "2026-06-27 03:00", "New Zealand", "Belgium", "G", "vancouver"),
    # Match 67-72: June 27 (Final matchday)
    (67, "2026-06-27 20:00", "Panama", "England", "L", "new_york"),
    (68, "2026-06-27 20:00", "Croatia", "Ghana", "L", "philadelphia"),
    (69, "2026-06-27 23:00", "Colombia", "Portugal", "K", "miami"),
    (70, "2026-06-27 23:00", "TBD (Intercontinental 1)", "Uzbekistan", "K", "atlanta"),
    (71, "2026-06-28 02:00", "Algeria", "Austria", "J", "kansas_city"),
    (72, "2026-06-28 02:00", "Jordan", "Argentina", "J", "dallas"),
]

# ──────────────────────────────────────────
# Famous player names by country
# ──────────────────────────────────────────
FAMOUS_PLAYERS = {
    "Brazil": [
        "Alisson", "Ederson", "Marquinhos", "Militao", "Danilo", "Alex Sandro", "Bremer",
        "Casemiro", "Paqueta", "Bruno G.", "Raphinha", "Rodrygo",
        "Vinicius Jr", "Richarlison", "Endrick",
    ],
    "Germany": [
        "Neuer", "ter Stegen", "Rudiger", "Schlotterbeck", "Raum", "Tah", "Sule",
        "Gundogan", "Kimmich", "Musiala", "Wirtz", "Sane",
        "Havertz", "Fullkrug", "Muller",
    ],
    "France": [
        "Maignan", "Areola", "Kounde", "Saliba", "T. Hernandez", "Upamecano", "Mendy",
        "Tchouameni", "Rabiot", "Griezmann", "Coman", "Dembele",
        "Mbappe", "Thuram", "Kolo Muani",
    ],
    "Argentina": [
        "E. Martinez", "Armani", "Otamendi", "Romero", "Molina", "Acuna", "Lisandro M.",
        "De Paul", "Enzo Fernandez", "Mac Allister", "Lo Celso", "Di Maria",
        "Messi", "Lautaro", "Julian Alvarez",
    ],
    "England": [
        "Pickford", "Ramsdale", "Stones", "Guehi", "Walker", "Shaw", "Trippier",
        "Rice", "Bellingham", "Foden", "Palmer", "Saka",
        "Kane", "Watkins", "Gordon",
    ],
    "Spain": [
        "Unai Simon", "Raya", "Carvajal", "Laporte", "Cucurella", "Le Normand", "Grimaldo",
        "Pedri", "Rodri", "Gavi", "Olmo", "Lamine Yamal",
        "Morata", "Joselu", "Nico Williams",
    ],
    "Portugal": [
        "Diogo Costa", "Rui Patricio", "Pepe", "Ruben Dias", "Cancelo", "Nuno Mendes", "Dalot",
        "Bruno Fernandes", "Bernardo", "Vitinha", "Joao Felix", "Otavio",
        "Ronaldo", "Goncalo Ramos", "Rafael Leao",
    ],
    "Netherlands": [
        "Verbruggen", "Flekken", "Van Dijk", "De Vrij", "Ake", "Dumfries", "Blind",
        "F. de Jong", "Reijnders", "Simons", "Gakpo", "Malen",
        "Depay", "Weghorst", "Zirkzee",
    ],
    "Belgium": [
        "Casteels", "Sels", "Vertonghen", "Faes", "Theate", "Castagne", "De Cuyper",
        "Tielemans", "Onana", "De Bruyne", "Doku", "Trossard",
        "Lukaku", "Openda", "Bakayoko",
    ],
    "Japan": [
        "Suzuki", "Osako GK", "Tomiyasu", "Itakura", "Nagatomo", "Taniguchi", "Machida",
        "Endo", "Kamada", "Kubo", "Mitoma", "Doan",
        "Maeda", "Ueda", "Asano",
    ],
    "Mexico": [
        "Ochoa", "Malagon", "Vasquez", "Montes", "Arteaga", "J. Sanchez", "K. Alvarez",
        "Edson Alvarez", "Romo", "Lozano", "Vega", "Pineda",
        "Jimenez", "Gimenez S.", "Huerta",
    ],
    "United States": [
        "Turner", "Horvath", "Dest", "Richards", "Robinson", "Scally", "Ream",
        "McKennie", "Adams", "Musah", "Reyna", "Aaronson",
        "Pulisic", "Weah", "Balogun",
    ],
    "Croatia": [
        "Livakovic", "Ivusic", "Gvardiol", "Sutalo", "Stanisic", "Sosa", "Juranovic",
        "Modric", "Brozovic", "Kovacic", "Sucic", "Majer",
        "Kramaric", "Petkovic", "Budimir",
    ],
    "Uruguay": [
        "Rochet", "Israel", "Gimenez", "Araujo", "Olivera", "Vina", "Nandez",
        "Valverde", "Bentancur", "Ugarte", "De Arrascaeta", "Pellistri",
        "Nunez", "Suarez", "Cavani",
    ],
    "Colombia": [
        "Vargas", "Montero GK", "Davinson Sanchez", "Lucumi", "Mojica", "Munoz", "Cuesta",
        "Lerma", "R. Rios", "James Rodriguez", "Arias", "Diaz",
        "Zapata", "Borja", "Cordoba",
    ],
    "Morocco": [
        "Bounou", "Munir", "Hakimi", "Saiss", "Aguerd", "Mazraoui", "Dari",
        "Amrabat", "Ounahi", "Ziyech", "Boufal", "Amallah",
        "En-Nesyri", "Hamdallah", "Aboukhlal",
    ],
    "Senegal": [
        "E. Mendy", "Dieng", "Koulibaly", "Diallo", "Sabaly", "Jakobs", "Cisse",
        "I. Gueye", "P. Gueye", "Sarr", "Diatta", "Ndiaye",
        "Dia", "Diedhiou", "Jackson",
    ],
    "South Korea": [
        "Kim S.G.", "Jo H.", "Kim M.J.", "Kim Y.G.", "Kim J.S.", "Hong C.", "Yoon J.G.",
        "Hwang I.B.", "Lee J.S.", "Lee K.I.", "Hwang H.C.", "Jeong W.Y.",
        "Son H.M.", "Cho G.S.", "Oh H.S.",
    ],
    "Australia": [
        "Ryan", "Vukovic", "Souttar", "Rowles", "Behich", "Atkinson", "Degenek",
        "Mooy", "Irvine", "McGree", "Baccus", "Hrustic",
        "Duke", "Maclaren", "Kuol",
    ],
    "Canada": [
        "Borjan", "Crepeau", "Johnston", "Cornelius", "Adekugbe", "Miller", "Laryea",
        "Eustaquio", "Kone", "Buchanan", "Shaffelburg", "Osorio",
        "David", "Larin", "Millar",
    ],
    "Qatar": [
        "Barsham", "Al Sheeb", "Pedro Miguel", "Khoukhi", "Hassan", "Ahmed", "Salman",
        "Boudiaf", "Hatem", "Al Haydos", "Madibo", "Asad",
        "Ali", "Afif", "Muntari",
    ],
    "Switzerland": [
        "Sommer", "Kobel", "Akanji", "Elvedi", "Rodriguez", "Widmer", "Stergiou",
        "Xhaka", "Freuler", "Shaqiri", "Ndoye", "Aebischer",
        "Embolo", "Duah", "Okafor",
    ],
    "Ecuador": [
        "Dominguez", "Galindez", "Preciado", "Torres F.", "Hincapie", "Porozo", "Estupinan",
        "Caicedo", "Franco", "Paez", "Sarmiento", "Plata",
        "Valencia E.", "Estrada", "Rodriguez E.",
    ],
    "Iran": [
        "Beiranvand", "Abedzadeh", "Hosseini", "Pouraliganji", "Mohammadi", "Moharrami", "Rezaeian",
        "Nourollahi", "Ezatolahi", "Hajsafi", "Ghoddos", "Jahanbakhsh",
        "Taremi", "Azmoun", "Ansarifard",
    ],
    "Algeria": [
        "Mandrea", "Zeghba", "Mandi", "Bedrane", "Atal", "Bensebaini", "Tougai",
        "Bennacer", "Zerrouki", "Feghouli", "Mahrez", "Belaili",
        "Bounedjah", "Slimani", "Benrahma",
    ],
    "Norway": [
        "Nyland", "Dyngeland", "Ryerson", "Ostigard", "Meling", "Pedersen M.", "Ajer",
        "Odegaard", "Berge", "Thorsby", "Elyounoussi", "Nusa",
        "Haaland", "Sorloth", "Strand Larsen",
    ],
}

# Position template for teams without famous player data
SQUAD_TEMPLATE = [
    ("GK", 4.5), ("GK", 4.0),
    ("DEF", 5.5), ("DEF", 5.0), ("DEF", 5.0), ("DEF", 4.5), ("DEF", 4.5),
    ("MID", 6.5), ("MID", 6.0), ("MID", 5.5), ("MID", 5.0), ("MID", 5.0),
    ("FWD", 7.0), ("FWD", 6.5), ("FWD", 6.0),
]

# Round definitions for group stage matchdays
ROUNDS = [
    {"name": "Group Stage - 1", "start": "2026-06-11", "end": "2026-06-18"},
    {"name": "Group Stage - 2", "start": "2026-06-18", "end": "2026-06-24"},
    {"name": "Group Stage - 3", "start": "2026-06-24", "end": "2026-06-28"},
]

# Match number to round mapping
MATCH_TO_ROUND = {}
for i in range(1, 25):
    MATCH_TO_ROUND[i] = 0  # Matchday 1
for i in range(25, 49):
    MATCH_TO_ROUND[i] = 1  # Matchday 2
for i in range(49, 73):
    MATCH_TO_ROUND[i] = 2  # Matchday 3


def seed():
    db = SessionLocal()
    try:
        existing = db.query(Team).count()
        if existing > 0:
            print(f"DB already has {existing} teams — skipping seed.")
            print("To re-seed: drop tables first or delete existing data.")
            return

        # ── Create teams ──
        team_ids = {}
        for t in TEAMS:
            tid = str(uuid.uuid4())
            team_ids[t["name"]] = tid
            db.add(Team(
                id=tid,
                external_id=f"wc26_{t['code'].lower()}",
                name=t["name"],
                country_code=t["code"],
                group_name=t["group"],
            ))
        db.flush()
        print(f"Created {len(TEAMS)} teams")

        # ── Create players ──
        player_count = 0
        for t in TEAMS:
            famous = FAMOUS_PLAYERS.get(t["name"], [])
            for i, (pos, price) in enumerate(SQUAD_TEMPLATE):
                if i < len(famous):
                    name = famous[i]
                else:
                    pos_label = {"GK": "Goalkeeper", "DEF": "Defender", "MID": "Midfielder", "FWD": "Forward"}
                    name = f"{t['name']} {pos_label.get(pos, pos)} {i + 1}"
                db.add(Player(
                    id=str(uuid.uuid4()),
                    external_id=f"wc26_{t['code'].lower()}_{i}",
                    team_id=team_ids[t["name"]],
                    name=name,
                    position=pos,
                    price=price,
                ))
                player_count += 1
        db.flush()
        print(f"Created {player_count} players")

        # ── Create rounds ──
        round_ids = []
        for r in ROUNDS:
            rid = str(uuid.uuid4())
            round_ids.append(rid)
            start = datetime.strptime(r["start"], "%Y-%m-%d")
            end = datetime.strptime(r["end"], "%Y-%m-%d")
            db.add(Round(
                id=rid,
                name=r["name"],
                start_utc=start,
                deadline_utc=start,  # deadline = first kickoff of matchday
                end_utc=end,
            ))
        db.flush()
        print(f"Created {len(ROUNDS)} rounds")

        # ── Create matches ──
        for match_num, kickoff_str, home, away, group, venue_key in MATCHES:
            kickoff = datetime.strptime(kickoff_str, "%Y-%m-%d %H:%M")
            venue = VENUES.get(venue_key, venue_key)
            round_idx = MATCH_TO_ROUND.get(match_num, 0)
            round_name = ROUNDS[round_idx]["name"]

            db.add(Match(
                id=str(uuid.uuid4()),
                external_id=f"wc26_match_{match_num}",
                home_team_id=team_ids[home],
                away_team_id=team_ids[away],
                kickoff_utc=kickoff,
                venue=venue,
                status=MatchStatus.SCHEDULED,
                home_score=None,
                away_score=None,
                round_name=f"{round_name} (Group {group})",
            ))
        db.flush()
        print(f"Created {len(MATCHES)} matches")

        db.commit()
        print("Seed complete!")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
