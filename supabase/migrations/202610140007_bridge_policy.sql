begin;
create policy view_bridge_service_read on cms_private.view_bridge for select to service_role using(true);
commit;
