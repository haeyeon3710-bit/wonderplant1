begin;
-- RLS still limits insertion to administrators. Copies preserve rich originals.
grant insert (legacy_article_html) on public.posts to authenticated;
commit;
