async function getQueryId() {
  return new URLSearchParams(window.location.search).get('id');
}

function showEditNotice(text, isError = false) {
  const el = document.getElementById('editNotice');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.background = isError ? '#fff1f1' : '#edf7f1';
  el.style.color = isError ? '#9b1c1c' : '#0d4d2e';
}

async function loadPublicationForEdit(id) {
  if (!window.db) throw new Error('No Supabase client.');
  const cols = ['id','title','authors','type','year','abstract','research_areas','isbn','doi','citation','publication_format','price','is_paid','preview_page_limit','cover_url','pdf_url','pdf_path','ebook_url','ebook_entry','ebook_path','preview_url'];
  const { data, error } = await window.db.from('publications').select(cols.join(',')).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Publication not found.');

  document.getElementById('pubId').value = data.id;
  document.getElementById('title').value = data.title || '';
  document.getElementById('authors').value = data.authors || '';
  document.getElementById('type').value = data.type || '';
  document.getElementById('year').value = data.year || '';
  document.getElementById('isbn').value = data.isbn || '';
  document.getElementById('doi').value = data.doi || '';
  document.getElementById('price').value = data.price ?? '';
  document.getElementById('isPaid').checked = Boolean(data.is_paid);
  document.getElementById('publicationFormat').value = data.publication_format || 'pdf';
  document.getElementById('previewPageLimit').value = data.preview_page_limit ?? '';
  document.getElementById('researchAreas').value = Array.isArray(data.research_areas) ? data.research_areas.join(', ') : (data.research_areas || '');
  document.getElementById('abstract').value = data.abstract || '';
  document.getElementById('citation').value = data.citation || '';

  const coverWrap = document.getElementById('currentCover');
  if (data.cover_url && coverWrap) coverWrap.innerHTML = `<a href="${data.cover_url}" target="_blank" rel="noopener">Current cover</a>`;

  const pdfWrap = document.getElementById('currentPdf');
  if ((data.pdf_url || data.pdf_path) && pdfWrap) pdfWrap.innerHTML = `<a href="${data.preview_url || data.pdf_url || '#'}" target="_blank" rel="noopener">View current PDF / preview</a>`;

  const ebookWrap = document.getElementById('currentEbook');
  if (data.ebook_url && ebookWrap) ebookWrap.innerHTML = `<a href="${data.ebook_url}" target="_blank" rel="noopener">Current eBook entry</a>`;
}

async function handleEditSubmit(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('pubId').value;
    if (!id) throw new Error('Missing publication id.');
    showEditNotice('Saving changes...');

    const title = document.getElementById('title').value.trim();
    const authors = document.getElementById('authors').value.trim();
    const type = document.getElementById('type').value.trim();
    const year = Number(document.getElementById('year').value) || null;
    const isbn = document.getElementById('isbn').value.trim() || null;
    const doi = document.getElementById('doi').value.trim() || null;
    const priceRaw = document.getElementById('price').value;
    const price = priceRaw === '' ? 0 : Number(priceRaw);
    const isPaid = document.getElementById('isPaid').checked;
    const publication_format = document.getElementById('publicationFormat').value || 'pdf';
    const preview_page_limit = Number(document.getElementById('previewPageLimit').value) || null;
    const research_areas = normalizeAreas(document.getElementById('researchAreas').value || '');
    const abstract = document.getElementById('abstract').value.trim();
    const citation = document.getElementById('citation').value.trim() || buildCitation({ authors, year, title, type, doi });

    const coverFile = document.getElementById('cover')?.files?.[0] || null;
    const pdfFile = document.getElementById('pdf')?.files?.[0] || null;
    const ebookFiles = document.getElementById('ebookFolder')?.files || [];
    let coverUpload = null;
    let pdfUpload = null;
    let previewUpload = null;
    let ebookUploadResult = null;

    if (coverFile) {
      showEditNotice('Uploading new cover...');
      coverUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_COVERS, coverFile, 'covers', { upsert: true });
    }

    if (pdfFile) {
      showEditNotice('Uploading PDF and creating preview...');
      if (isPaid) {
        const previewFile = await makePreviewPdfFile(pdfFile, 4);
        previewUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, previewFile, 'previews', { upsert: true });
        pdfUpload = await uploadFile('paid-documents', pdfFile, 'documents', { private: true, upsert: true });
      } else {
        pdfUpload = await uploadFile(window.APP_CONFIG.STORAGE_BUCKET_DOCUMENTS, pdfFile, 'documents', { upsert: true });
        previewUpload = { publicUrl: pdfUpload.publicUrl, path: pdfUpload.path };
      }
    }

    if (ebookFiles && ebookFiles.length) {
      showEditNotice('Uploading HTML eBook folder...');
      const titleSafe = title || `ebook-${Date.now()}`;
      ebookUploadResult = await uploadHtmlEbookFolder(ebookFiles, titleSafe);
    }

    const payload = {
      title,
      authors,
      type,
      year,
      abstract,
      research_areas,
      isbn,
      doi,
      citation,
      publication_format,
      price,
      is_paid: publication_format === 'pdf' ? Boolean(isPaid) : false,
      preview_page_limit: publication_format === 'pdf' ? (preview_page_limit || 4) : null
    };

    if (coverUpload?.publicUrl) payload.cover_url = coverUpload.publicUrl;
    if (pdfUpload) {
      if (pdfUpload.path) payload.pdf_path = pdfUpload.path;
      if (pdfUpload.publicUrl) payload.pdf_url = pdfUpload.publicUrl;
      if (previewUpload?.publicUrl) payload.preview_url = previewUpload.publicUrl;
      if (previewUpload?.path && !previewUpload.publicUrl) payload.preview_url = previewUpload.path;
    }
    if (ebookUploadResult) {
      payload.ebook_url = findEntryUrl(ebookUploadResult, document.getElementById('ebookEntry')?.value || 'index.html');
      payload.ebook_entry = document.getElementById('ebookEntry')?.value || 'index.html';
      payload.ebook_path = `ebooks/${ebookUploadResult.folderId}/`;
    }

    const { data, error } = await window.db.from('publications').update(payload).eq('id', id).select().single();
    if (error) throw error;

    if (pdfFile && data?.id) {
      await rmrdcIndexPublicationPdf(pdfFile, data.id, document.getElementById('editNotice'));
    }

    showEditNotice('Publication updated successfully. Redirecting...', false);
    setTimeout(() => { window.location.href = 'index.html#publications'; }, 1200);
  } catch (err) {
    console.error(err);
    showEditNotice(err.message || 'Save failed.', true);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const id = await getQueryId();
    if (!id) {
      showEditNotice('No publication id provided in the URL.', true);
      return;
    }
    await loadPublicationForEdit(id);
    document.getElementById('editPublicationForm').addEventListener('submit', handleEditSubmit);
  } catch (err) {
    console.error(err);
    showEditNotice(err.message || 'Could not load publication.', true);
  }
});
