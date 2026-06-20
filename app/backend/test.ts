import { supabase } from "./supabase";
console.log(await supabase.from('game').select("*"));