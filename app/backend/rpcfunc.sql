create or replace function count_trues_in_column(
  table_name text,
  column_name text
)
returns integer as $$declare
  result integer;
begin
  execute format('
    select sum(case when %s = true then 1 else 0 end)
    from %s
  ', column_name, table_name)
  into result;
  
  return result;
end;$$ language plpgsql;