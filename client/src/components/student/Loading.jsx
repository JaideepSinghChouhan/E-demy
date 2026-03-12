import React, { useContext, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'

const Loading = () => {
  const { path } = useParams()
  const { navigate, backendUrl, getToken, fetchUserEnrolledCourses } = useContext(AppContext)

  useEffect(() => {
    if (path) {
      // Check for Stripe session_id in URL params to verify payment
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get('session_id')

      const verifyAndRedirect = async () => {
        if (sessionId) {
          try {
            const token = await getToken()
            await axios.post(
              backendUrl + '/api/user/verify-payment',
              { sessionId },
              { headers: { Authorization: `Bearer ${token}` } }
            )
            await fetchUserEnrolledCourses()
          } catch (error) {
            toast.error(error.message)
          }
        }
        // Navigate to the target path after a short delay
        setTimeout(() => navigate('/' + path), 1500)
      }

      verifyAndRedirect()
    }
  }, [path])

  return (
    <div className='min-h-screen flex flex-col items-center justify-center gap-4'>
      <div className='w-16 sm:w-20 aspect-square border-4 border-gray-300 border-t-4 border-t-blue-400 rounded-full animate-spin'></div>
      <p className='text-gray-500 text-sm'>Processing your payment...</p>
    </div>
  )
}

export default Loading
