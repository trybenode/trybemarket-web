'use client'
import BackBtn from '../components/BackButton'
import UserProfile from './UserProfile'

export default function Header({title}){
    return(
        <div className='p-2 mb-3 flex justify-between items-center border-b-[0.5] border-yellow-300'>
            <BackBtn />
             <h3 className="text-lg font-semibold text-gray-800 truncate">{title}</h3>

            <UserProfile />
        </div>
    )
}