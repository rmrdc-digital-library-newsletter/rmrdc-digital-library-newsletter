(function () {

const SAVED_KEY = "rmrdc_saved_publications";
const HISTORY_KEY = "rmrdc_reading_history";

/**
 * Get the currently authenticated Supabase user ID.
 */
async function getReaderId() {

    if (!window.db) {
        console.warn("Supabase client not available.");
        return null;
    }

    const {
        data: { user },
        error
    } = await window.db.auth.getUser();

    if (error) {
        console.warn(error.message);
        return null;
    }

    return user?.id ?? null;
}

/**
 * Local storage helpers
 */
function getLocal(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
        return [];
    }
}

function setLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Store only the fields needed for dashboard display.
 */
function compact(pub) {

    return {

        id: pub.id,

        title: pub.title,

        authors: pub.authors,

        type: pub.type,

        year: pub.year,

        cover_url: pub.cover_url,

        abstract: pub.abstract,

        research_areas: pub.research_areas || [],

        saved_at: new Date().toISOString(),

        viewed_at: new Date().toISOString()

    };

}

/**
 * Save publication
 */
async function savePublication(pub) {

    if (!pub?.id) return;

    const reader_id = await getReaderId();

    if (!reader_id) {
        alert("Please log in to save publications.");
        return;
    }

    // Keep local copy for offline use
    const item = compact(pub);

    const saved = getLocal(SAVED_KEY)
        .filter(p => p.id !== pub.id);

    saved.unshift(item);

    setLocal(SAVED_KEY, saved.slice(0, 100));

    // Save to Supabase
    if (window.db) {

        const { error } = await window.db
            .from("saved_publications")
            .upsert(
                {
                    reader_id: reader_id,
                    publication_id: pub.id,
                    saved_at: new Date().toISOString()
                },
                {
                    onConflict: "reader_id,publication_id"
                }
            );

        if (error) {
            console.warn(error.message);
        }

    }

    alert("Publication saved to your dashboard.");

}

/**
 * Record reading history
 */
async function recordReadingHistory(pub) {

    if (!pub?.id) return;

    const reader_id = await getReaderId();

    if (!reader_id) return;

    // Keep local copy
    const item = compact(pub);

    const history = getLocal(HISTORY_KEY)
        .filter(p => p.id !== pub.id);

    history.unshift(item);

    setLocal(HISTORY_KEY, history.slice(0, 100));

    // Save to Supabase
    if (window.db) {

        const { error } = await window.db
            .from("reading_history")
            .insert({
                reader_id: reader_id,
                publication_id: pub.id,
                viewed_at: new Date().toISOString()
            });

        if (error) {
            console.warn(error.message);
        }

    }

}

/**
 * Public API
 */
window.RMRDCUserFeatures = {

    getReaderId,

    getSaved: () => getLocal(SAVED_KEY),

    getHistory: () => getLocal(HISTORY_KEY),

    savePublication,

    recordReadingHistory

};

})();
