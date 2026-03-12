import React, { useContext } from 'react'
import { assets } from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import { Link } from 'react-router-dom'

const CourseCard = ({course}) => {

const { currency, calculateRating } = useContext(AppContext)

const discountedPrice = (course.coursePrice - course.discount * course.coursePrice / 100).toFixed(2)

  return (
    <Link to={'/course/' + course._id} onClick={()=> scrollTo(0,0)} className='border border-gray-200 pb-4 overflow-hidden rounded-xl hover:shadow-md transition-shadow duration-200 bg-white group'>
      <div className='relative overflow-hidden'>
        <img className='w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300' src={course.courseThumbnail} alt={course.courseTitle} />
        {course.discount > 0 && (
          <span className='absolute top-2 right-2 bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full'>
            {course.discount}% OFF
          </span>
        )}
      </div>
      <div className='p-3 text-left'>
        <h3 className='text-sm font-semibold text-gray-800 line-clamp-2 leading-snug'>{course.courseTitle}</h3>
        <p className='text-xs text-gray-400 mt-1'>{course.educator?.name || 'Instructor'}</p>
        <div className='flex items-center space-x-1 mt-1.5'>
          <p className='text-xs font-medium text-yellow-600'>{calculateRating(course).toFixed(1)}</p>
          <div className='flex'>
            {[...Array(5)].map((_, i)=>(
              <img key={i} src={i < Math.floor(calculateRating(course)) ? assets.star : assets.star_blank} alt='' className='w-3 h-3' />
            ))}
          </div>
          <p className='text-xs text-gray-400'>({course.courseRatings.length})</p>
        </div>
        <div className='flex items-center gap-2 mt-2'>
          <p className='text-sm font-bold text-gray-900'>{currency}{discountedPrice}</p>
          {course.discount > 0 && (
            <p className='text-xs text-gray-400 line-through'>{currency}{course.coursePrice}</p>
          )}
        </div>
      </div>
    </Link>
  )
}

export default CourseCard
