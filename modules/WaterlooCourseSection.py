import re
import copy
import logging
import simplejson
from KeyedObject import KeyedObject
import QualifierExceptions

try:
    import Databases
    from pysqlite2 import dbapi2 as sqlite
    enableRateMyProfessors = True
    rateMyProfessorsCon = sqlite.connect( Databases.rateMyProfessorsDatabase )
except ImportError:
    enableRateMyProfessors = False

class WaterlooCourseSection:
    c_date_map = { "M": 1, "T": 2, "W": 3, "Th": 4, "F": 5, "S": 6 }
    c_date_re = re.compile( "(\d{2}):(\d{2})-(\d{2}):(\d{2})(\w+)" )
    sectionInformation = [
        KeyedObject( "Section Number", "section_num").getJson(),
        KeyedObject( "Catalog Number", "unique_name").getJson(),
        KeyedObject( "Time(s)", "date_string").getJson(),
        KeyedObject( "Room", "room" ).getJson(),
        KeyedObject( "Instructor", "instructor" ).getJson(),
        KeyedObject( "Rate My Professors Quality", "rmp_quality" ).getJson(),
        KeyedObject( "Rate My Professors Ease", "rmp_ease" ).getJson()
    ]

    def __init__( self, parent ):
        self.parent = parent
        self.courseName = ""
        self.uniqueName = ""
        self.instructor = ""
        self.room = ""
        self.campus = ""
        self.sectionNum = ""
        self.related1 = ""
        self.related2 = ""
        self.enrlCap = -1
        self.enrlTot = -1
        self.hasValidDate = False
        self.validTimes = [[] for i in xrange(7)]
        self.rateMyProfessorsQuality = None
        self.rateMyProfessorsEase = None
        self.rateMyProfessorsURL  = None
        self.dateString = ""


    def __hash__( self ):
        return hash(self.uniqueName + self.courseName)

    def dump( self ):
        return """WaterlooCourseSection: %(name)s Instructor:'%(instructor)s' Room:'%(room)s' valid:'%(times)s""" % \
                {"name": self.uniqueName, "instructor": self.instructor, "room": self.room, "times": self.validTimes}

    def getJson( self ):
        return {  "unique_name": self.uniqueName,
                "section_num": self.sectionNum,
                "instructor": self.instructor,
                "room": self.room,
                "campus": self.campus,
                "valid_times": self.validTimes,
                "related1" : self.related1,
                "related2" : self.related2,
                "rmp_quality" : self.rateMyProfessorsQuality,
                "rmp_ease" : self.rateMyProfessorsEase,
                "rmp_url"  : self.rateMyProfessorsURL,
                "date_string" : self.dateString
            } 

    def getReferenceJson( self ):
        return {
                    "courseName": self.courseName,
                    "sectionName": self.uniqueName
                }

    def full( self ):
        if self.enrlCap == -1 or self.enrlTot == -1:
            return True

        return self.enrlTot >= self.enrlCap

    def jsonDump( self ):
        return simplejson.dumps( self.getJson() )

    def setRateMyProfessorsInfo( self ):
        if not enableRateMyProfessors:
            return

        try:
            last, first = self.instructor.split(",")
        except ValueError:
            return

        try:
            matchFirst=  first[:first.index(" ") + 1]
        except ValueError:
            matchFirst = first

        cursor = rateMyProfessorsCon.cursor()
        cursor.execute( "SELECT first_name, last_name, quality, ease, url  FROM waterloo WHERE UPPER(last_name)=?", (last.upper(),) )

        for row in cursor:
            if row[0].lower().startswith( matchFirst.lower() ) or matchFirst.lower().startswith( row[0].lower() ):
                self.rateMyProfessorsQuality = row[2]
                self.rateMyProfessorsEase = row[3] 
                self.rateMyProfessorsURL  = row[4] 
                break

    def conflictsWith( self, otherSection ):
        for myDayTime, otherDayTime in zip( self.validTimes, otherSection.validTimes):
            for (myStartTime, myEndTime) in myDayTime:
                for (otherStartTime, otherEndTime) in otherDayTime:
        #            if myStartTime >= otherStartTime and myStartTime <= otherEndTime:
         #               return True
          #          if myEndTime >= otherStartTime and myEndTime <= otherEndTime:
#                        return True
		     if (myStartTime <= otherEndTime and myEndTime >= otherEndTime):
			 return True

        return False

    def startsAfter( self, time ):
        for dayTime in self.validTimes:
            for startTime, endTime in dayTime:
                if startTime != False and startTime < time:
                    return False
        return True

    def endsEarlier( self, time ):
        for dayTime in self.validTimes:
            for startTime, endTime in dayTime:
                if endTime != False and endTime > time:
                    return False
        return True


    def parseDateFromStr( self, dateStr ):
        # This may be the second time we are adding
        self.dateString = ("%s %s" % (self.dateString, dateStr)).strip()
        if dateStr.upper() == "TBA":
            return

        match = self.c_date_re.match( dateStr )
        if not match:
            return

        startHour, startMinute, endHour, endMinute = map(int,match.groups()[:-1])
        days = match.groups()[-1]
        if startHour < 8 or (startHour == 8 and startMinute < 20):
            startHour += 12
            endHour += 12
        elif endHour < 9:
            endHour += 12


        startTimeSeconds = 60*60*startHour + 60*startMinute
        endTimeSeconds = 60*60*endHour + 60*endMinute

        curDay = days[0]
        validDays = []
        for char in days[1:]:
            if curDay and char.isupper():
                validDays.append( curDay )
                curDay = char
            else:
                curDay += char 

        validDays.append( curDay )

        for day in validDays:
            self.hasValidDate = True
            self.validTimes[ self.c_date_map[day] ].append( ( startTimeSeconds, endTimeSeconds ))