"use client";
import { useEffect, useState } from "react";
import { addPlayer } from "../backend/funcs";
import { Joystick } from "./joystick";

export let uuid:string;

export const MobileConnect = () => {
    const [name,setName] = useState("");
    const [submit,setSubmit] = useState(false);
    const [joinedUuid, setJoinedUuid] = useState<string | null>(null);

    useEffect(()=>{
        if (!submit) return;
        const t = async() =>{
            const result = await addPlayer(name);
            if (result.uuid) {
                uuid = result.uuid;
                setJoinedUuid(result.uuid);
            }
        } 
        t();
    },[submit, name])

    if (joinedUuid) {
        return <Joystick uuid={joinedUuid} />;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-3xl font-bold mb-8 text-blue-400">Join Game</h1>
            <div className="w-full max-w-sm space-y-4">
                <input 
                    className="w-full px-4 py-3 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors text-white"
                    onChange={(e)=>{setName(e.target.value)}} 
                    placeholder="Enter Your Name" 
                    value={name}
                />
                <button 
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors disabled:opacity-50"
                    onClick={()=>{setSubmit(true)}}
                    disabled={!name}
                >
                    Join
                </button>
            </div>
        </div>
    )
}