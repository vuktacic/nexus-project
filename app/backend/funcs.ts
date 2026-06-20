import { supabase } from "./supabase";

export async function addPlayer(name: string) {
  let shark = false;
  let sharkCount = 0;
  let nonShark = 0;

  const { data, error } = await supabase.from("game").select("shark");

  if (error) {
    return { error: error.message, uuid: null };
  }

  data?.forEach((val) => {
    if (val.shark) {
      sharkCount++;
    } else {
      nonShark++;
    }
  });

  if (sharkCount < nonShark) {
    shark = true;
  }

  const positionY = Math.floor(1000 * Math.random());
  const positionX = Math.floor(
    shark ? 90 * Math.random() + 10 : 90 * Math.random() + 900
  );

  const { data: inserted, error: insertError } = await supabase
    .from("game")
    .insert({
      name,
      positionX,
      positionY,
      gold: 0,
      shark,
      shield: false,
    })
    .select();

  if (insertError) {
    return { error: insertError.message, uuid: null };
  }

  // change this depending on your table columns:
  // if your row has "uuid", use inserted[0].uuid
  // if your row has "id", use inserted[0].id
  const player = inserted?.[0];

  return {
    error: null,
    uuid: player?.uuid ?? player?.id ?? null,
  };
}

export async function getTeamGold(shark: boolean) {
  const { data, error } = await supabase.from("game").select("*");

  if (error) {
    console.error(error.message);
    return 0;
  }

  let gold = 0;
  data?.forEach((value) => {
    if (value.shark === shark) {
      gold += value.gold;
    }
  });

  return gold;
}

export async function setTeamGold(shark: boolean, amount: number) {
    const { data, error } = await supabase.from("game").select("*");
}

export async function getSingleGold(uuid:string){
    const {data,error} = await supabase.from('game').select('gold').eq("uuid",uuid).single();
    if (error){
        console.error(error.message);
    }
    return data?.gold;
}

export async function setSingleGold(uuid:string, amount:number) {
    const { data, error } = await supabase.from("game").update({ gold: amount }).eq("uuid", uuid);

    if (error) {
        console.error(error.message);
    }

    return data;
}

export async function getShield(uuid: string) {}

export async function setShield(uuid: string, shieldUp: boolean) {}

export async function getPosition(uuid: string) {}

export async function setPosition(uuid: string, position: { x: number; y: number }) {}

export async function getName(uuid: string) {}

export async function setName(uuid: string, name: string) {}

export async function getUUID(uuid: string) {}

export async function setUUID(uuid: string, newUUID: string) {}