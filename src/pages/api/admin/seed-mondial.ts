import type { APIRoute } from "astro";
import { isAdminAuthed } from "../../../lib/auth";
import { requireDatabase } from "../../../lib/neon";

export const prerender = false;

// Dev/staging seed endpoint — creates tables + inserts test data
// Only usable when authenticated as admin

export const POST: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthed(cookies)) {
    return new Response(JSON.stringify({ error: "Non autorisé." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sql = requireDatabase();

  try {
    // 1. Create tables if not exist
    await sql`
      CREATE TABLE IF NOT EXISTS mondial_inscriptions (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'USA',
        city TEXT NOT NULL,
        state_us TEXT NOT NULL,
        matchs_vises JSONB NOT NULL DEFAULT '[]',
        opt_in_mur BOOLEAN NOT NULL DEFAULT false,
        ip_address TEXT,
        user_agent TEXT,
        verification_status TEXT NOT NULL DEFAULT 'pending',
        anti_fraud_flags JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT mondial_inscriptions_email_unique UNIQUE (email)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS justificatifs_identite (
        id SERIAL PRIMARY KEY,
        inscription_id INTEGER NOT NULL REFERENCES mondial_inscriptions(id) ON DELETE CASCADE,
        type_document TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 2. Insert test inscriptions
    const testData = [
      { first_name: "Arnold",    last_name: "Mubuanga",   dob: "1992-03-15", email: "arnold@test.com",    phone: "+12145550001", city: "Houston",     state: "TX", matches: ["houston","atlanta"],                     opt_in: true,  status: "verified" },
      { first_name: "Merveille", last_name: "Kasongo",    dob: "1995-07-22", email: "merveille@test.com", phone: "+14045550002", city: "Atlanta",     state: "GA", matches: ["atlanta"],                               opt_in: true,  status: "verified" },
      { first_name: "Béni",      last_name: "Lubambo",    dob: "1990-11-08", email: "beni@test.com",      phone: "+12145550003", city: "Dallas",      state: "TX", matches: ["houston","guadalajara"],                 opt_in: false, status: "verified" },
      { first_name: "Jonathan",  last_name: "Ngoy",       dob: "1998-01-30", email: "jonathan@test.com",  phone: "+12125550004", city: "New York",    state: "NY", matches: ["houston"],                               opt_in: true,  status: "pending"  },
      { first_name: "Sarah",     last_name: "Mbuluku",    dob: "1993-05-12", email: "sarah@test.com",     phone: "+12025550005", city: "Washington",  state: "DC", matches: ["houston","atlanta","guadalajara"],       opt_in: true,  status: "verified" },
      { first_name: "Grace",     last_name: "Tshilumba",  dob: "1997-09-18", email: "grace@test.com",     phone: "+13235550006", city: "Los Angeles", state: "CA", matches: ["houston"],                               opt_in: false, status: "pending"  },
      { first_name: "Dieudonné", last_name: "Kabila",     dob: "1988-12-03", email: "dieudonne@test.com", phone: "+13125550007", city: "Chicago",     state: "IL", matches: ["atlanta"],                               opt_in: true,  status: "flagged"  },
      { first_name: "Rachel",    last_name: "Ntumba",     dob: "1996-04-25", email: "rachel@test.com",    phone: "+13055550008", city: "Miami",       state: "FL", matches: ["houston","atlanta"],                     opt_in: true,  status: "verified" },
      { first_name: "Christian", last_name: "Kalala",     dob: "1991-08-14", email: "christian@test.com", phone: "+12065550009", city: "Seattle",     state: "WA", matches: ["guadalajara"],                           opt_in: false, status: "pending"  },
      { first_name: "Esther",    last_name: "Mwamba",     dob: "1994-02-07", email: "esther@test.com",    phone: "+17135550010", city: "Houston",     state: "TX", matches: ["houston","atlanta","guadalajara"],       opt_in: true,  status: "verified" },
      { first_name: "Gloire",    last_name: "Muteba",     dob: "1999-06-01", email: "gloire@test.com",    phone: "+12145550011", city: "Houston",     state: "TX", matches: ["houston"],                               opt_in: true,  status: "verified" },
      { first_name: "Patience",  last_name: "Lukusa",     dob: "1993-11-17", email: "patience@test.com",  phone: "+14695550012", city: "Dallas",      state: "TX", matches: ["houston","atlanta"],                     opt_in: true,  status: "verified" },
      { first_name: "Samuel",    last_name: "Bwanga",     dob: "1987-03-28", email: "samuel@test.com",    phone: "+14045550013", city: "Atlanta",     state: "GA", matches: ["atlanta","guadalajara"],                 opt_in: true,  status: "pending"  },
      { first_name: "Naomi",     last_name: "Kikunda",    dob: "2001-08-05", email: "naomi@test.com",     phone: "+17135550014", city: "Houston",     state: "TX", matches: ["houston"],                               opt_in: true,  status: "verified" },
      { first_name: "David",     last_name: "Ngoyi",      dob: "1985-12-22", email: "david@test.com",     phone: "+13235550015", city: "Los Angeles", state: "CA", matches: ["guadalajara"],                           opt_in: false, status: "verified" },
      { first_name: "Miriam",    last_name: "Bukasa",     dob: "1996-07-11", email: "miriam@test.com",    phone: "+17325550016", city: "Newark",      state: "NJ", matches: ["houston","atlanta"],                     opt_in: true,  status: "pending"  },
      { first_name: "Josué",     last_name: "Tshimanga",  dob: "1994-04-03", email: "josue@test.com",     phone: "+13125550017", city: "Chicago",     state: "IL", matches: ["houston"],                               opt_in: true,  status: "verified" },
      { first_name: "Lydie",     last_name: "Mulumba",    dob: "1998-09-29", email: "lydie@test.com",     phone: "+14045550018", city: "Stone Mountain","state": "GA", matches: ["atlanta"],                          opt_in: true,  status: "verified" },
      { first_name: "Patrick",   last_name: "Mutombo",    dob: "1989-01-14", email: "patrick@test.com",   phone: "+16785550019", city: "Marietta",    state: "GA", matches: ["atlanta","houston"],                     opt_in: false, status: "pending"  },
      { first_name: "Carine",    last_name: "Ilunga",     dob: "2000-05-20", email: "carine@test.com",    phone: "+17135550020", city: "Sugarland",   state: "TX", matches: ["houston","guadalajara","atlanta"],       opt_in: true,  status: "verified" },
    ];

    let inserted = 0;
    for (const row of testData) {
      try {
        const [insc] = await sql`
          INSERT INTO mondial_inscriptions
            (first_name, last_name, date_of_birth, email, phone, country, city, state_us,
             matchs_vises, opt_in_mur, ip_address, verification_status, anti_fraud_flags)
          VALUES
            (${row.first_name}, ${row.last_name}, ${row.dob}, ${row.email}, ${row.phone},
             'USA', ${row.city}, ${row.state}, ${JSON.stringify(row.matches)},
             ${row.opt_in}, '127.0.0.1', ${row.status}, '[]')
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `;
        if (insc?.id) {
          await sql`
            INSERT INTO justificatifs_identite
              (inscription_id, type_document, original_filename, stored_filename, mime_type, size, checksum, status)
            VALUES
              (${insc.id}, 'PASSPORT', 'passport_test.jpg',
               ${'test-' + insc.id + '.jpg'}, 'image/jpeg', 512000,
               ${'test-hash-' + insc.id}, 'pending')
            ON CONFLICT DO NOTHING
          `;
          inserted++;
        }
      } catch {
        // Skip duplicates
      }
    }

    // 3. Ensure settings keys exist
    await sql`
      INSERT INTO settings (key, value) VALUES ('mondial_tickets_count', '100')
      ON CONFLICT (key) DO NOTHING
    `;
    await sql`
      INSERT INTO settings (key, value) VALUES ('mondial_tirage_publie', 'false')
      ON CONFLICT (key) DO NOTHING
    `;

    return new Response(
      JSON.stringify({ success: true, inserted, message: `${inserted} inscriptions créées.` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Seed mondial error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Erreur serveur." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
