/* Final Convex Hull Algorithm */

-- use a temp table to clear query up and improve performance
if object_id('tempdb..#res') is not null
	drop table #res
select coords.longitude
	, coords.latitude
into #res
from [dbo].[Job]

inner join Incident
	on Job.incident_id = Incident.id
inner join Site
	on Incident.site_id = Site.site_id
inner join Appointment as app
	on Job.id = app.job_id
inner join Resource as res
	on app.resource_id = res.id
inner join PostcodeCoordinates as coords
	on Site.site_postcode_nospace = coords.postcode

where res.name = '@Request.islResName~'
	and Job.job_enddate is not null
	
	-- OAN-84 12/05/2015	
	and (Job.job_enddate >= '@Request.islStartDate~' or '@Request.islStartDate~' = '')
	and (Job.job_enddate <= '@Request.islEndDate~' or '@Request.islEndDate~' = '')


declare @XML as varchar(max) = '<?xml version="1.0"?><gpx version="1.0"><trk><trkseg>';
declare @mapWidth as int = 200;
declare @mapHeight as int = 100;

-- start with the left most point in the set
declare @p_start_x as float = (
	select top 1
		(longitude + 180)*(@mapWidth/ 360.0)
	from #res
	order by (longitude + 180)*(@mapWidth/ 360.0)
	);

declare @p_start_y as float = (
	select top 1
		((@mapHeight/ 2.0)-(@mapWidth*(log(tan((pi()/ 4) + (((latitude*pi())/180.0)/ 2.0))))/ (2*pi())))*-1
	from #res
	order by (longitude + 180)*(@mapWidth/ 360.0)
	);

-- store lng lat of starting point
declare @p_start_x_LONG as float = (
	select top 1
		longitude
	from #res
	order by (longitude + 180)*(@mapWidth/ 360.0)
	);

declare @p_start_y_LAT as float = (
	select top 1
		latitude
	from #res
	order by (longitude + 180)*(@mapWidth/ 360.0)
	);

-- write this point to our output xml as it's on the convex hull
set @XML += '<trkpt lat="' + cast(@p_start_y_LAT as varchar(50)) + '" lon="' + cast(@p_start_x_LONG as varchar(50)) + '"></trkpt>'

declare @p_current_x as float = @p_start_x;
declare @p_current_y as float = @p_start_y;

-- define a 'previous' point which is directly below p_start
declare @p_last_x as float = @p_current_x;
declare @p_last_y as float = @p_current_y - 1;

-- declare temps - to be updated with cursor values
declare @temp_x as float;
declare @temp_y as float;

-- declare all neccessary looping variables
declare @smallestAngle as float;
declare @best_x as float;
declare @best_y as float;
declare @current_vector_i as float;
declare @current_vector_j as float;
declare @next_vector_i as float;
declare @next_vector_j as float;
declare @angle as float;
declare @i as int = 1

while 1 = 1
begin
	
	--print @i
	set @i += 1

	declare curs cursor for
	select distinct
		(longitude + 180)*(@mapWidth/ 360.0)
		, ((@mapHeight/ 2.0)-(@mapWidth*(log(tan((pi()/ 4) + (((latitude*pi())/180.0)/ 2.0))))/ (2*pi())))*-1

	from #res
	order by (longitude + 180)*(@mapWidth/ 360.0)
	open curs 
	fetch next from curs
	into @temp_x, @temp_y

	-- find the next vertex of the polygon
	-- i.e. the point which makes the smallest angle
	-- with the line p_last ------> p_current.
	set @smallestAngle = 2*pi()
	set @best_x = 0
	set @best_y = 0
	set @current_vector_i = @p_current_x - @p_last_x
	set @current_vector_j = @p_current_y - @p_last_y
	
	-- begin cursor...
	while @@fetch_status = 0
	begin

		if @temp_x = @p_current_x
		begin
			if @temp_y = @p_current_y
			begin
				--print 'continue'
				fetch next from curs
				into @temp_x, @temp_y
			end
		end

		-- find the angle between this point and the last
		set @next_vector_i = @temp_x - @p_current_x
		set @next_vector_j = @temp_y - @p_current_y
		set @angle = dbo.AngleBetween(@current_vector_i, @current_vector_j, @next_vector_i, @next_vector_j)
		--print '@temp_x:'+ cast(@temp_x as varchar(50)) + '  angle=' + cast(@angle as varchar(50))

		if @angle < @smallestAngle
		begin
			--print '@angle < @smallestAngle -> @smallestAngle=' + cast(@angle as varchar(50))
			set @smallestAngle = @angle
			set @best_x = @temp_x
			set @best_y = @temp_y
		end

		fetch next from curs
		into @temp_x, @temp_y
	end

	--print '@best_x=' + cast(@best_x as varchar(50)) + '  @best_y:' + cast(@best_y as varchar(50)) + ' with an angle of ' + cast(@smallestAngle as varchar(50))  + '  NOTE: @p_start_x=' + cast(@p_start_x as varchar(50)) 

	-- check whether we've reached the start
	if @best_x = @p_start_x
	begin
		if @best_y = @p_start_y
		begin
			break
		end
	end

	-- best_x and best_y now define the next point on the polygon.
	-- Need to add the actual lats and lngs here. Could maybe do it through the cursor, but I have rearranged the Mercator projection inline here: (beware - could be rounding error)
	set @XML += '<trkpt lat="' + cast(((360.0*atan(exp(pi()*((@mapHeight - 2*(-@best_y))/ @mapWidth))) - 90*pi())/ pi()) as varchar(50)) + '" lon="' + cast(((360.0*(@best_x) - 180.0*@mapWidth)/ @mapWidth) as varchar(50)) + '"></trkpt>'

	set @p_last_x = @p_current_x
	set @p_last_y = @p_current_y
	set @p_current_x = @best_x
	set @p_current_y = @best_y

	close curs;
	deallocate curs;

end

-- complete the XML string with the starting point and close its tags
set @XML += '<trkpt lat="' + cast(@p_start_y_LAT as varchar(50)) + '" lon="' + cast(@p_start_x_LONG as varchar(50)) + '"></trkpt>'
set @XML += '</trkseg></trk></gpx>'

--print @XML

close curs;
deallocate curs;


select @XML as GPXString